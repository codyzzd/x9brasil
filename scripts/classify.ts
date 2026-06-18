import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import {
  PUBLIC_VALUE_CATEGORIES,
  VOTE_METHODOLOGY_VERSION,
  buildPublicVoteRecord,
  getProposalWeight,
  proposalStageMultiplier,
  publicValueClassificationMetadata,
  type CandidateVote,
  type ClassificationConfidence,
  type ParticipationRole,
  type ProposalNature,
  type ProposalStage,
  type PublicValueCategory,
  type PublicVoteAnalysis,
  type PublicVoteClassification,
  type PublicVoteSeverity,
  type PublicInterestVote,
} from "../src/lib/public-value";
import {
  detectContextLimit,
  estimateTokens,
  formatCompletionDate,
  formatEta,
  getFullTextForProposal,
  getFullTextForVote,
  type FullTextResult,
} from "./analyzer";
import {
  getProvider,
  interactiveSelect,
  loadConfig,
  saveConfig,
  type AnalysisMode,
} from "./providers";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PAGE_SIZE = 1000;
const BATCH_SIZE = 500;
const DEFAULT_LIMIT = 10;
const DEFAULT_DELAY_MS = 2000;

type Row = Record<string, unknown>;
type ClassifyTarget = "votes" | "proposals" | "both";
type ClassifyScope = "improvable" | "overwrite";
type AnalysisLevel = 2 | 3;

type ProposalRow = {
  id: string;
  type: string | null;
  number: string | null;
  year: string | null;
  proposal_date: string | null;
  summary: string | null;
  status: string | null;
  url: string | null;
};

type VoteRow = {
  id: string;
  vote_date: string | null;
  description: string | null;
  summary: string | null;
  url: string | null;
  session_number: string | null;
};

type ClassificationRow = {
  source: string | null;
  analysis_level: number | null;
};

type LegislatorProposalRow = {
  legislator_id: number;
  proposal_id: string;
  period_id: string;
  participation_role: string;
  proposal_nature: string;
};

type LegislatorVoteRow = {
  id: number;
  legislator_id: number;
  vote_id: string;
  period_id: string;
  candidate_vote: CandidateVote;
  score_delta: number | string;
  confidence: number | string | null;
};

type ProposalLlmResult = {
  category: PublicValueCategory;
  confidence: ClassificationConfidence;
  justification: string;
};

type VoteLlmResult = {
  classification: PublicVoteClassification;
  severity: PublicVoteSeverity;
  publicInterestVote: PublicInterestVote;
  confidence: number;
  reason: string;
};

type RunStats = {
  proposals: { classified: number; failed: number; skipped: number; metricRows: number };
  votes: { classified: number; failed: number; skipped: number; metricRows: number; linksUpdated: number };
};
type Wizard = ReturnType<typeof createInterface>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function question(rl: Wizard, prompt: string) {
  const answer = await rl.question(prompt);
  return answer.trim();
}

function chunks<T>(items: T[], size = BATCH_SIZE) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function fetchAll<T extends Row>(table: string, select = "*", orderColumn = "id") {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from(table).select(select).order(orderColumn).range(from, to);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchByIds<T extends Row>(table: string, ids: string[], select = "*", column = "id") {
  const rows: T[] = [];
  if (ids.length === 0) return rows;
  const orderColumn = table === "proposal_classifications" ? "proposal_id" : "id";
  for (const batch of chunks(ids)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .in(column, batch)
        .order(orderColumn)
        .range(from, to);
      if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
      rows.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

async function upsertBatches(table: string, rows: Row[], onConflict: string) {
  for (const batch of chunks(rows)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`Failed to upsert ${table}: ${error.message}`);
  }
}

function pairKey(legislatorId: number, periodId: string) {
  return `${legislatorId}|${periodId}`;
}

function sessionNumberFromVoteId(voteId: string): string | null {
  const [, ...rest] = voteId.split("-");
  return rest.length > 0 ? rest.join("-") : null;
}

function inferStage(status: string | null | undefined): ProposalStage {
  const normalized = (status ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  if (/transformad|convertid/.test(normalized) && /norma|lei/.test(normalized)) return "converted";
  if (/apresentacao de proposicao|recebimento/.test(normalized)) return "presented";
  return "advanced";
}

function existingLevel(row: ClassificationRow | undefined) {
  if (!row) return 0;
  if (row.analysis_level === 1 || row.analysis_level === 2 || row.analysis_level === 3) {
    return row.analysis_level;
  }
  return row.source === "rule" ? 1 : row.source === "llm" ? 2 : 3;
}

function shouldClassify(row: ClassificationRow | undefined, level: AnalysisLevel, scope: ClassifyScope) {
  const current = existingLevel(row);
  if (current > level) return false;
  return scope === "overwrite" ? current <= level : current < level;
}

function cleanJson(text: string) {
  return text.replace(/```json\s*|\s*```/g, "").trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function clampConfidence(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.75;
  return Math.min(1, Math.max(0, parsed));
}

function truncatePrompt(prompt: string, model: string) {
  const contextLimit = detectContextLimit(model);
  const tokens = estimateTokens(prompt);
  if (tokens <= contextLimit * 0.8) return prompt;
  const maxChars = Math.floor(contextLimit * 0.75 * 4);
  return `${prompt.slice(0, maxChars)}\n\n[... TEXTO TRUNCADO por limite de contexto ...]`;
}

function shortText(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function progressLine(params: {
  index: number;
  total: number;
  runStartedAt: number;
  recentDurations: number[];
  label: string;
}) {
  const current = params.index + 1;
  const remaining = params.total - current;
  const elapsedMs = Date.now() - params.runStartedAt;
  const avgMs = params.recentDurations.length > 0
    ? params.recentDurations.reduce((sum, value) => sum + value, 0) / params.recentDurations.length
    : 0;
  const etaLabel = avgMs > 0
    ? `${formatEta(avgMs * (remaining + 1))} · fim ~${formatCompletionDate(avgMs * (remaining + 1))}`
    : "calculando";
  console.log(`\n▸ [${current}/${params.total}] ${params.label}`);
  console.log(`  Faltam: ${remaining} | Decorrido: ${formatEta(elapsedMs)} | ETA: ${etaLabel}`);
}

function recordDuration(recentDurations: number[], startedAt: number) {
  const elapsedMs = performance.now() - startedAt;
  recentDurations.push(elapsedMs);
  if (recentDurations.length > 10) recentDurations.shift();
  return elapsedMs;
}

function proposalPrompt(proposal: ProposalRow, level: AnalysisLevel, fullText?: FullTextResult) {
  const fullTextBlock = level === 3 && fullText
    ? `\nTEXTO INTEGRAL DA PROPOSIÇÃO:\n${fullText.text}\n`
    : "";
  return `Você é um analista político sênior especializado no processo legislativo brasileiro.
Classifique a proposição da Câmara dos Deputados de acordo com valor público e interesse social.
${fullTextBlock}
DADOS OFICIAIS:
ID: ${proposal.id}
Tipo: ${proposal.type ?? ""} ${proposal.number ?? ""}/${proposal.year ?? ""}
Data: ${proposal.proposal_date ?? ""}
Ementa: ${proposal.summary ?? ""}
Situação: ${proposal.status ?? ""}

CATEGORIAS DE VALOR PÚBLICO:
- "anti_corruption": combate à corrupção, improbidade, integridade pública.
- "public_transparency": transparência, acesso à informação, dados abertos, prestação de contas.
- "waste_reduction": redução de desperdício, despesa pública, economia de recursos.
- "health": saúde pública, SUS, medicamentos, hospitais, vacinas.
- "education": educação, escolas, ensino, universidades, professores, estudantes.
- "security": segurança pública, polícia, crime, violência, política penal.
- "infrastructure": infraestrutura, saneamento, rodovias, transporte público, habitação.
- "jobs_economy": emprego, renda, economia, tributos, empresas, crédito.
- "state_modernization": modernização da administração pública, gestão pública, governo digital.
- "technology_innovation": tecnologia, inovação, digital, IA, software, internet.
- "deregulation": desburocratização, simplificação, licenciamento.
- "tribute": medalha, título honorífico ou homenagem.
- "commemorative_date": dia, semana ou data comemorativa.
- "motion": moção, voto de louvor, pesar ou repúdio.
- "place_naming": denominação de bem público.

Responda APENAS com JSON válido:
{
  "category": "anti_corruption" | "public_transparency" | "waste_reduction" | "health" | "education" | "security" | "infrastructure" | "jobs_economy" | "state_modernization" | "technology_innovation" | "deregulation" | "tribute" | "commemorative_date" | "motion" | "place_naming",
  "confidence": "high" | "medium" | "low",
  "justification": "Explicação curta e simples em português, com 1 ou 2 frases, dizendo o critério principal e por que a proposição se enquadra nessa categoria."
}`;
}

function votePrompt(vote: VoteRow, level: AnalysisLevel, fullText?: FullTextResult) {
  const fullTextBlock = level === 3 && fullText
    ? `\nTEXTO INTEGRAL DA PROPOSIÇÃO RELACIONADA:\n${fullText.text}\n`
    : "";
  return `Você é um analista político sênior especializado no processo legislativo brasileiro.
Classifique a votação da Câmara dos Deputados de acordo com impacto público e interesse social.
${fullTextBlock}
DADOS OFICIAIS:
ID da votação: ${vote.id}
Data: ${vote.vote_date ?? ""}
Descrição oficial: ${vote.description ?? ""}
Resumo da proposição associada: ${vote.summary ?? ""}

CLASSIFICAÇÃO:
- "positive_public_interest": promove transparência, integridade, eficiência pública ou melhoria social estrutural.
- "negative_public_interest": reduz transparência/fiscalização ou aumenta privilégios/custos públicos prejudiciais.
- "harmful_or_self_serving": beneficia diretamente políticos, partidos ou a classe política.
- "low_relevance": homenagem, denominação, data comemorativa ou ato simbólico.
- "neutral": tema técnico, procedimental ou sem impacto público amplo claro.

VOTO DE INTERESSE PÚBLICO:
- "yes": votar sim é alinhado ao interesse público.
- "no": votar não é alinhado ao interesse público.
- "any": sim e não são aceitáveis.
- "none": relevância baixa ou procedimento sem voto recomendado.

SEVERIDADE:
- "critical": PEC, reforma estrutural, salário/verba política ou impacto fiscal/democrático massivo.
- "high": lei federal relevante ou marco regulatório de alto impacto.
- "medium": alteração menor ou impacto regulatório específico.
- "low": homenagem, data, símbolo ou ajuste de baixa consequência.

Responda APENAS com JSON válido:
{
  "classification": "positive_public_interest" | "neutral" | "low_relevance" | "negative_public_interest" | "harmful_or_self_serving",
  "severity": "low" | "medium" | "high" | "critical",
  "publicInterestVote": "yes" | "no" | "any" | "none",
  "confidence": 0.0 a 1.0,
  "reason": "Explicação curta e simples em português, com 1 ou 2 frases, dizendo o critério principal, por que a votação recebeu essa classificação e qual voto fica alinhado ao interesse público."
}`;
}

function parseProposalResult(text: string): ProposalLlmResult {
  const parsed = JSON.parse(cleanJson(text)) as Partial<ProposalLlmResult>;
  const categories = Object.keys(PUBLIC_VALUE_CATEGORIES);
  if (!parsed.category || !categories.includes(parsed.category)) {
    throw new Error(`categoria inválida: ${parsed.category}`);
  }
  if (!["high", "medium", "low"].includes(String(parsed.confidence))) {
    throw new Error(`confiança inválida: ${parsed.confidence}`);
  }
  if (!parsed.justification || parsed.justification.length < 10) {
    throw new Error("justificativa ausente ou curta demais");
  }
  return {
    category: parsed.category,
    confidence: parsed.confidence,
    justification: parsed.justification,
  };
}

function parseVoteResult(text: string): VoteLlmResult {
  const parsed = JSON.parse(cleanJson(text)) as Partial<VoteLlmResult>;
  const classifications = ["positive_public_interest", "neutral", "low_relevance", "negative_public_interest", "harmful_or_self_serving"];
  const severities = ["low", "medium", "high", "critical"];
  const publicVotes = ["yes", "no", "any", "none"];
  if (!parsed.classification || !classifications.includes(parsed.classification)) {
    throw new Error(`classificação inválida: ${parsed.classification}`);
  }
  if (!parsed.severity || !severities.includes(parsed.severity)) {
    throw new Error(`severidade inválida: ${parsed.severity}`);
  }
  if (!parsed.publicInterestVote || !publicVotes.includes(parsed.publicInterestVote)) {
    throw new Error(`publicInterestVote inválido: ${parsed.publicInterestVote}`);
  }
  if (!parsed.reason || parsed.reason.length < 10) {
    throw new Error("justificativa ausente ou curta demais");
  }
  return {
    classification: parsed.classification,
    severity: parsed.severity,
    publicInterestVote: parsed.publicInterestVote,
    confidence: clampConfidence(parsed.confidence),
    reason: parsed.reason,
  };
}

async function updateMetricRows(rows: Row[]) {
  if (rows.length === 0) return;
  const updateMap = new Map(rows.map((row) => [pairKey(Number(row.legislator_id), String(row.period_id)), row]));
  const periodIds = [...new Set(rows.map((row) => String(row.period_id)))];
  const existingRows = await fetchByIds<Row>("legislator_period_metrics", periodIds, "*", "period_id");
  const mergedRows: Row[] = [];

  for (const existing of existingRows) {
    const key = pairKey(Number(existing.legislator_id), String(existing.period_id));
    const update = updateMap.get(key);
    if (!update) continue;
    mergedRows.push({ ...existing, ...update });
  }

  await upsertBatches("legislator_period_metrics", mergedRows, "legislator_id,period_id");
}

async function updateProposalMetrics(proposalIds: string[]) {
  if (proposalIds.length === 0) return 0;
  const affectedLinks = await fetchByIds<LegislatorProposalRow>(
    "legislator_proposals",
    proposalIds,
    "legislator_id, proposal_id, period_id, participation_role, proposal_nature",
    "proposal_id",
  );
  const affectedPairs = new Set(affectedLinks.map((row) => pairKey(row.legislator_id, row.period_id)));
  if (affectedPairs.size === 0) return 0;

  const periodIds = [...new Set(affectedLinks.map((row) => row.period_id))];
  const allLinks = (await fetchByIds<LegislatorProposalRow>(
    "legislator_proposals",
    periodIds,
    "legislator_id, proposal_id, period_id, participation_role, proposal_nature",
    "period_id",
  )).filter((row) => affectedPairs.has(pairKey(row.legislator_id, row.period_id)));

  const allProposalIds = [...new Set(allLinks.map((row) => row.proposal_id))];
  const [classRows, proposalRows] = await Promise.all([
    fetchByIds<{
      proposal_id: string;
      category: keyof typeof PUBLIC_VALUE_CATEGORIES;
    }>("proposal_classifications", allProposalIds, "proposal_id, category", "proposal_id"),
    fetchByIds<ProposalRow>("proposals", allProposalIds, "id, status"),
  ]);
  const classMap = new Map(classRows.map((row) => [row.proposal_id, row]));
  const proposalMap = new Map(proposalRows.map((row) => [row.id, row]));
  const grouped = new Map<string, LegislatorProposalRow[]>();

  for (const link of allLinks) {
    const key = pairKey(link.legislator_id, link.period_id);
    grouped.set(key, [...(grouped.get(key) ?? []), link]);
  }

  const metricRows = [...affectedPairs].map((key) => {
    const [legislatorId, periodId] = key.split("|");
    const links = grouped.get(key) ?? [];
    let points = 0;
    let classified = 0;

    for (const link of links) {
      const classification = classMap.get(link.proposal_id);
      if (!classification) continue;
      const category = PUBLIC_VALUE_CATEGORIES[classification.category];
      const stage = inferStage(proposalMap.get(link.proposal_id)?.status);
      classified += 1;
      points += getProposalWeight({
        categoryWeight: category.weight,
        stageMultiplier: proposalStageMultiplier(stage),
        role: link.participation_role as ParticipationRole,
        nature: link.proposal_nature as ProposalNature,
        stage,
      });
    }

    return {
      legislator_id: Number(legislatorId),
      period_id: periodId,
      public_contribution_points: classified > 0 ? Number(points.toFixed(2)) : null,
      public_classified_proposals: classified,
      public_total_proposals: links.length,
    };
  });

  await updateMetricRows(metricRows);
  return metricRows.length;
}

async function updateLegislatorVotes(analyses: Map<string, PublicVoteAnalysis>) {
  if (analyses.size === 0) return new Set<string>();
  const links = await fetchByIds<LegislatorVoteRow>(
    "legislator_votes",
    [...analyses.keys()],
    "id, legislator_id, vote_id, period_id, candidate_vote, score_delta, confidence",
    "vote_id",
  );
  const affectedPairs = new Set<string>();
  const rows = links.flatMap((link) => {
    const analysis = analyses.get(link.vote_id);
    if (!analysis) return [];
    const record = buildPublicVoteRecord(analysis, link.legislator_id, link.candidate_vote);
    affectedPairs.add(pairKey(link.legislator_id, link.period_id));
    return [{
      id: link.id,
      legislator_id: link.legislator_id,
      vote_id: link.vote_id,
      period_id: link.period_id,
      candidate_vote: link.candidate_vote,
      score_delta: record.scoreDelta,
      confidence: record.confidence,
      reason: record.reason,
      source: record.source,
      reviewed_manually: record.reviewedManually,
    }];
  });

  await upsertBatches("legislator_votes", rows, "id");
  return affectedPairs;
}

async function updateVoteMetrics(affectedPairs: Set<string>) {
  if (affectedPairs.size === 0) return 0;
  const periodIds = [...new Set([...affectedPairs].map((key) => key.split("|")[1]))];
  const rows = await fetchByIds<LegislatorVoteRow>(
    "legislator_votes",
    periodIds,
    "id, legislator_id, vote_id, period_id, candidate_vote, score_delta, confidence",
    "period_id",
  );
  const groups = new Map<string, LegislatorVoteRow[]>();
  for (const row of rows) {
    const key = pairKey(row.legislator_id, row.period_id);
    if (!affectedPairs.has(key) || row.confidence === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const metricRows = [...affectedPairs].map((key) => {
    const [legislatorId, periodId] = key.split("|");
    const votes = groups.get(key) ?? [];
    let positive = 0;
    let votePenalties = 0;
    let absencePenalties = 0;
    let confidence = 0;

    for (const vote of votes) {
      const delta = Number(vote.score_delta ?? 0);
      if (delta > 0) positive += delta;
      else if (delta < 0 && vote.candidate_vote === "absent") absencePenalties += Math.abs(delta);
      else if (delta < 0) votePenalties += Math.abs(delta);
      confidence += Number(vote.confidence ?? 0);
    }

    const analyzed = votes.length;
    return {
      legislator_id: Number(legislatorId),
      period_id: periodId,
      public_vote_positive_points: Number(positive.toFixed(2)),
      public_vote_negative_penalties: Number(votePenalties.toFixed(2)),
      public_vote_absence_penalties: Number(absencePenalties.toFixed(2)),
      public_votes_analyzed: analyzed,
      public_vote_average_confidence: analyzed > 0 ? Number((confidence / analyzed).toFixed(3)) : null,
      public_vote_score: analyzed > 0 ? Number((positive - votePenalties - absencePenalties).toFixed(2)) : null,
    };
  });

  await updateMetricRows(metricRows);
  return metricRows.length;
}

async function classifyProposals(params: {
  level: AnalysisLevel;
  scope: ClassifyScope;
  limit: number;
  provider: ReturnType<typeof getProvider>;
  model: string;
}) {
  const metadata = publicValueClassificationMetadata();
  const [proposals, existing] = await Promise.all([
    fetchAll<ProposalRow>("proposals", "id, type, number, year, proposal_date, summary, status, url"),
    fetchAll<{ proposal_id: string; source: string | null; analysis_level: number | null }>(
      "proposal_classifications",
      "proposal_id, source, analysis_level",
      "proposal_id",
    ),
  ]);
  const existingMap = new Map(existing.map((row) => [row.proposal_id, row]));
  const candidates = proposals.filter((proposal) => shouldClassify(existingMap.get(proposal.id), params.level, params.scope));
  const toProcess = candidates.slice(0, params.limit);
  const updatedProposalIds: string[] = [];
  const recentDurations: number[] = [];
  const runStartedAt = Date.now();
  let failed = 0;

  console.log(`\nProposições elegíveis: ${candidates.length}; processando ${toProcess.length}`);
  for (let index = 0; index < toProcess.length; index++) {
    const proposal = toProcess[index];
    const start = performance.now();
    const label = `${proposal.type ?? "Proposição"} ${proposal.number ?? proposal.id}/${proposal.year ?? ""}`.replace(/\/$/, "");
    progressLine({
      index,
      total: toProcess.length,
      runStartedAt,
      recentDurations,
      label,
    });
    if (proposal.summary) {
      console.log(`  Resumo: ${shortText(proposal.summary, 180)}`);
    }
    try {
      let fullText: FullTextResult | undefined;
      if (params.level === 3) {
        const result = await getFullTextForProposal(Number(proposal.id));
        if (!result) {
          const elapsedMs = recordDuration(recentDurations, start);
          console.log(`  ⚠ Sem inteiro teor, pulando nível 3 (${formatEta(elapsedMs)})`);
          continue;
        }
        fullText = result;
        console.log(`  Inteiro teor: ${result.wordCount} palavras, ~${result.tokenEstimate} tokens (${result.fromCache ? "cache" : "baixado"})`);
      }
      const response = await params.provider.generateContent(
        truncatePrompt(proposalPrompt(proposal, params.level, fullText), params.model),
        { model: params.model, temperature: 0.1, responseMimeType: "application/json" },
      );
      const parsed = parseProposalResult(response);
      await upsertBatches("proposal_classifications", [{
        proposal_id: proposal.id,
        category: parsed.category,
        confidence: parsed.confidence,
        justification: parsed.justification,
        source: "llm",
        analysis_level: params.level,
        methodology_version: metadata.methodologyVersion,
        updated_at: new Date().toISOString(),
      }], "proposal_id");
      updatedProposalIds.push(proposal.id);
      const elapsedMs = recordDuration(recentDurations, start);
      console.log(`  ✓ Classificação: ${PUBLIC_VALUE_CATEGORIES[parsed.category].label} (${parsed.confidence})`);
      console.log(`  Justificativa: ${shortText(parsed.justification)}`);
      console.log(`  Tempo do item: ${formatEta(elapsedMs)}`);
    } catch (error) {
      const elapsedMs = recordDuration(recentDurations, start);
      failed += 1;
      console.log(`  ✗ Falha: ${errorMessage(error).substring(0, 120)}`);
      console.log(`  Tempo do item: ${formatEta(elapsedMs)}`);
    }
    if (index < toProcess.length - 1) await sleep(DEFAULT_DELAY_MS);
  }

  const metricRows = await updateProposalMetrics(updatedProposalIds);
  return { classified: updatedProposalIds.length, failed, skipped: toProcess.length - updatedProposalIds.length - failed, metricRows };
}

async function classifyVotes(params: {
  level: AnalysisLevel;
  scope: ClassifyScope;
  limit: number;
  provider: ReturnType<typeof getProvider>;
  model: string;
}) {
  const [votes, existing] = await Promise.all([
    fetchAll<VoteRow>("votes", "id, vote_date, description, summary, url, session_number"),
    fetchAll<{ vote_id: string; source: string | null; analysis_level: number | null }>(
      "vote_classifications",
      "vote_id, source, analysis_level",
    ),
  ]);
  const existingMap = new Map(existing.map((row) => [row.vote_id, row]));
  const candidates = votes.filter((vote) => shouldClassify(existingMap.get(vote.id), params.level, params.scope));
  const toProcess = candidates.slice(0, params.limit);
  const analyses = new Map<string, PublicVoteAnalysis>();
  const recentDurations: number[] = [];
  const runStartedAt = Date.now();
  let failed = 0;

  console.log(`\nVotações elegíveis: ${candidates.length}; processando ${toProcess.length}`);
  for (let index = 0; index < toProcess.length; index++) {
    const vote = toProcess[index];
    const start = performance.now();
    progressLine({
      index,
      total: toProcess.length,
      runStartedAt,
      recentDurations,
      label: vote.id,
    });
    if (vote.description) {
      console.log(`  Descrição: ${shortText(vote.description, 180)}`);
    }
    try {
      let fullText: FullTextResult | undefined;
      if (params.level === 3) {
        const result = await getFullTextForVote(vote.id);
        if (!result) {
          const elapsedMs = recordDuration(recentDurations, start);
          console.log(`  ⚠ Sem inteiro teor, pulando nível 3 (${formatEta(elapsedMs)})`);
          continue;
        }
        fullText = result;
        console.log(`  Inteiro teor: proposição #${result.proposicaoId}, ${result.wordCount} palavras, ~${result.tokenEstimate} tokens (${result.fromCache ? "cache" : "baixado"})`);
      }
      const response = await params.provider.generateContent(
        truncatePrompt(votePrompt(vote, params.level, fullText), params.model),
        { model: params.model, temperature: 0.1, responseMimeType: "application/json" },
      );
      const parsed = parseVoteResult(response);
      const analysis: PublicVoteAnalysis = {
        voteId: vote.id,
        classification: parsed.classification,
        severity: parsed.severity,
        publicInterestVote: parsed.publicInterestVote,
        confidence: parsed.confidence,
        reason: parsed.reason,
        source: "llm",
        analysisLevel: params.level,
        reviewedManually: false,
        methodologyVersion: VOTE_METHODOLOGY_VERSION,
      };
      await upsertBatches("vote_classifications", [{
        vote_id: vote.id,
        session_number: vote.session_number ?? sessionNumberFromVoteId(vote.id),
        classification: analysis.classification,
        severity: analysis.severity,
        public_interest_vote: analysis.publicInterestVote,
        confidence: analysis.confidence,
        reason: analysis.reason,
        source: "llm",
        analysis_level: params.level,
        reviewed_manually: false,
        methodology_version: analysis.methodologyVersion,
        updated_at: new Date().toISOString(),
      }], "vote_id,session_number");
      analyses.set(vote.id, analysis);
      const elapsedMs = recordDuration(recentDurations, start);
      console.log(`  ✓ Classificação: ${parsed.classification} | Severidade: ${parsed.severity} | Voto público: ${parsed.publicInterestVote}`);
      console.log(`  Justificativa: ${shortText(parsed.reason)}`);
      console.log(`  Tempo do item: ${formatEta(elapsedMs)}`);
    } catch (error) {
      const elapsedMs = recordDuration(recentDurations, start);
      failed += 1;
      console.log(`  ✗ Falha: ${errorMessage(error).substring(0, 120)}`);
      console.log(`  Tempo do item: ${formatEta(elapsedMs)}`);
    }
    if (index < toProcess.length - 1) await sleep(DEFAULT_DELAY_MS);
  }

  const affectedPairs = await updateLegislatorVotes(analyses);
  const metricRows = await updateVoteMetrics(affectedPairs);
  return {
    classified: analyses.size,
    failed,
    skipped: toProcess.length - analyses.size - failed,
    linksUpdated: affectedPairs.size,
    metricRows,
  };
}

async function selectTarget(rl: Wizard, lastTarget?: "votes" | "proposals") {
  const fallback = lastTarget === "proposals" ? "2" : "1";
  console.log("\nO que você quer classificar?");
  console.log("  1) Votações");
  console.log("  2) Proposições");
  console.log("  3) Ambos");
  const answer = await question(rl, `Escolha [${fallback}]: `);
  if ((answer || fallback) === "2") return "proposals" as const;
  if ((answer || fallback) === "3") return "both" as const;
  return "votes" as const;
}

async function selectLevel(rl: Wizard, configMode: AnalysisMode) {
  const fallback = configMode === "advanced" ? "3" : "2";
  console.log("\nNível de análise:");
  console.log("  2) IA com resumo/descrição");
  console.log("  3) IA com inteiro teor");
  const answer = await question(rl, `Escolha [${fallback}]: `);
  return (answer || fallback) === "3" ? 3 : 2;
}

async function selectScope(rl: Wizard) {
  console.log("\nEscopo:");
  console.log("  1) Pendentes/melhoráveis — respeita a precedência dos níveis");
  console.log("  2) Sobrescrever — reprocessa classificações do mesmo nível ou inferior");
  const answer = await question(rl, "Escolha [1]: ");
  return answer === "2" ? "overwrite" : "improvable";
}

async function selectLimit(rl: Wizard) {
  const answer = await question(rl, `\nLimite por alvo [${DEFAULT_LIMIT}]: `);
  const parsed = Number(answer || DEFAULT_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_LIMIT;
}

async function confirmRun(rl: Wizard, params: {
  target: ClassifyTarget;
  level: AnalysisLevel;
  scope: ClassifyScope;
  limit: number;
  providerName: string;
  model: string;
}) {
  console.log("\nResumo da execução:");
  console.log(`  Alvo: ${params.target === "votes" ? "Votações" : params.target === "proposals" ? "Proposições" : "Ambos"}`);
  console.log(`  Nível: ${params.level}`);
  console.log(`  Escopo: ${params.scope === "overwrite" ? "Sobrescrever mesmo nível/inferior" : "Pendentes/melhoráveis"}`);
  console.log(`  Limite por alvo: ${params.limit}`);
  console.log(`  Provedor/modelo: ${params.providerName} / ${params.model}`);
  const answer = await question(rl, "Executar e gravar no Supabase? [s/N]: ");
  return answer.toLocaleLowerCase("pt-BR") === "s";
}

async function main() {
  const config = await loadConfig();
  const firstRl = createInterface({ input: process.stdin, output: process.stdout });
  const target = await selectTarget(firstRl, config.lastTarget);
  const level = await selectLevel(firstRl, config.lastMode);
  const scope = await selectScope(firstRl);
  const limit = await selectLimit(firstRl);
  firstRl.close();

  const selection = await interactiveSelect(config, "classificar");

  const confirmRl = createInterface({ input: process.stdin, output: process.stdout });
  const canRun = await confirmRun(confirmRl, {
    target,
    level,
    scope,
    limit,
    providerName: selection.provider.name,
    model: selection.model,
  });
  confirmRl.close();
  if (!canRun) {
    console.log("Execução cancelada.");
    return;
  }

  config.lastProvider = selection.provider.id;
  config.lastModel = selection.model;
  config.lastMode = level === 3 ? "advanced" : "basic";
  config.lastTarget = target === "both" ? "votes" : target;
  await saveConfig(config);

  const started = Date.now();
  const stats: RunStats = {
    proposals: { classified: 0, failed: 0, skipped: 0, metricRows: 0 },
    votes: { classified: 0, failed: 0, skipped: 0, metricRows: 0, linksUpdated: 0 },
  };
  const runParams = { level, scope, limit, provider: selection.provider, model: selection.model };

  if (target === "votes" || target === "both") {
    stats.votes = await classifyVotes(runParams);
  }
  if (target === "proposals" || target === "both") {
    stats.proposals = await classifyProposals(runParams);
  }

  const elapsedMs = Date.now() - started;
  console.log("\n====================================");
  console.log("Classificação LLM gravada diretamente no Supabase");
  console.log(`Nível gravado: ${level}`);
  console.log(`Tempo total: ${formatEta(elapsedMs)} (${formatCompletionDate(0)})`);
  console.log(`Votações: ${stats.votes.classified} classificadas, ${stats.votes.failed} falhas, ${stats.votes.skipped} puladas, ${stats.votes.metricRows} métricas recalculadas`);
  console.log(`Proposições: ${stats.proposals.classified} classificadas, ${stats.proposals.failed} falhas, ${stats.proposals.skipped} puladas, ${stats.proposals.metricRows} métricas recalculadas`);
}

main().catch((error: unknown) => {
  console.error("Erro fatal durante a classificação:", error);
  process.exit(1);
});
