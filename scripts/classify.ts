import { loadEnvConfig } from "@next/env";
import { createInterface } from "node:readline/promises";
import { createClient } from "../src/lib/database/client";
import {
  PUBLIC_VALUE_CATEGORIES,
  VOTE_METHODOLOGY_VERSION,
  LEGISLATIVE_IMPACT_V4_VERSION,
  buildPublicVoteRecord,
  getProposalWeight,
  inferLegislativeType,
  inferVoteObjectSubtype,
  inferVoteObjectType,
  normalizeProposalAnalysis,
  normalizeVoteAnalysis,
  proposalStageMultiplier,
  publicValueClassificationMetadata,
  type CandidateVote,
  type ClassificationConfidence,
  type ClassificationSource,
  type CriticalArticle,
  type DecisionNature,
  type DecisionScope,
  type LegislativeType,
  type NetPublicEffect,
  type ParticipationRole,
  type ProposalNature,
  type ProposalStage,
  type PublicValueCategory,
  type PublicVoteAnalysis,
  type PublicVoteClassification,
  type PublicVoteSeverity,
  type PublicInterestVote,
  type RiskFlag,
  type ScoreImpactLimit,
  type SummaryMatchesText,
  type VoteObjectType,
  type VoteObjectSubtype,
  type PrimaryTextUsed,
  type ModelRecommendation,
  type ModelRole,
  type RiskLevel,
  type AnalysisStatus,
  type CoverageCategory,
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
  type ProviderId,
} from "./providers";

loadEnvConfig(process.cwd());

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable");
  process.exit(1);
}

const supabase = createClient();

const PAGE_SIZE = 1000;
const BATCH_SIZE = 500;
const VOTE_LINK_READ_BATCH_SIZE = 10;
const METRIC_LEGISLATOR_READ_BATCH_SIZE = 10;
const MATERIALIZE_CLASSIFICATION_BATCH_SIZE = 25;
const DEFAULT_LIMIT = 10;
const DEFAULT_CONCURRENCY = 1;
const DEFAULT_DELAY_MS = 2000;
const TERMINAL_COLORS_ENABLED = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

function colorize(text: string, code: number) {
  return TERMINAL_COLORS_ENABLED ? `\x1b[${code}m${text}\x1b[0m` : text;
}

const terminal = {
  success: (text: string) => colorize(text, 32),
  error: (text: string) => colorize(text, 31),
  warning: (text: string) => colorize(text, 33),
  info: (text: string) => colorize(text, 36),
  muted: (text: string) => colorize(text, 90),
};

function colorStatus(status: ClassificationRunStatus) {
  if (status === "completed") return terminal.success(status);
  if (status === "failed" || status === "cancelled") return terminal.error(status);
  if (status === "paused") return terminal.warning(status);
  return terminal.info(status);
}

type Row = Record<string, unknown>;
type ClassifyTarget = "votes" | "proposals" | "both";
type ClassifyScope = "improvable" | "overwrite";
type AnalysisLevel = 2 | 3;
type PostProcessMode = "classify_only" | "classify_and_recalculate" | "materialize_only";
type ClassificationRunMode = "new" | "resume" | "retry_failed";
type ClassificationRunStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
type ClassificationRunItemStatus = "pending" | "processing" | "classified" | "failed" | "skipped";

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

type ClassificationRunRow = {
  id: string;
  target: ClassifyTarget;
  analysis_level: AnalysisLevel;
  scope: ClassifyScope;
  limit_per_target: number;
  concurrency: number;
  post_process_mode: PostProcessMode;
  provider: string | null;
  model: string | null;
  strong_review_enabled?: boolean | null;
  strong_provider?: string | null;
  strong_model?: string | null;
  method_version: string | null;
  status: ClassificationRunStatus;
  total_items: number;
  pending_count: number;
  processing_count: number;
  classified_count: number;
  failed_count: number;
  skipped_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type ClassificationRunItemRow = {
  id: number;
  run_id: string;
  target: "votes" | "proposals";
  item_id: string;
  item_label: string | null;
  status: ClassificationRunItemStatus;
  error_kind: string | null;
  error_message: string | null;
  attempts: number;
  duration_ms: number | null;
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
  score_points?: number | string | null;
  confidence: number | string | null;
  affects_score?: boolean | null;
  analysis_status?: AnalysisStatus | null;
  needs_strong_review?: boolean | null;
  review_reason?: string | null;
  coverage_category?: CoverageCategory | null;
  score_safety_reason?: string | null;
  model_used?: string | null;
  model_role?: ModelRole | null;
};

type VoteClassificationRow = {
  vote_id: string;
  classification: PublicVoteClassification;
  severity: PublicVoteSeverity;
  public_interest_vote: PublicInterestVote;
  confidence: number | string;
  reason: string;
  source: ClassificationSource;
  analysis_level: AnalysisLevel | number | null;
  reviewed_manually: boolean | null;
  methodology_version: string | null;
  analysis_method_version?: string | null;
  legislative_type?: LegislativeType | null;
  decision_nature?: DecisionNature | null;
  decision_scope?: DecisionScope | null;
  vote_object_type?: VoteObjectType | null;
  vote_object_description?: string | null;
  yes_means?: string | null;
  no_means?: string | null;
  analyzed_text_matches_vote_object?: SummaryMatchesText | null;
  score_impact_limit?: ScoreImpactLimit | null;
  is_procedural_vote?: boolean | null;
  declared_benefit?: string | null;
  hidden_cost?: string | null;
  net_public_effect?: NetPublicEffect | null;
  has_tradeoff?: boolean | null;
  summary_matches_text?: SummaryMatchesText | null;
  risk_flags?: RiskFlag[] | null;
  critical_articles?: CriticalArticle[] | null;
  analysis_payload?: Record<string, unknown> | null;
  model_used?: string | null;
  model_role?: ModelRole | null;
  analysis_status?: AnalysisStatus | null;
  risk_level?: RiskLevel | null;
  needs_strong_review?: boolean | null;
  review_reason?: string | null;
  coverage_category?: CoverageCategory | null;
  affects_score?: boolean | null;
  score_safety_reason?: string | null;
};

type ProposalLlmResult = {
  category: PublicValueCategory;
  confidence: ClassificationConfidence;
  justification: string;
  analysisMethodVersion?: string;
  legislativeType?: LegislativeType;
  decisionNature?: DecisionNature;
  decisionScope?: DecisionScope;
  declaredBenefit?: string;
  hiddenCost?: string;
  netPublicEffect?: NetPublicEffect;
  hasTradeoff?: boolean;
  summaryMatchesText?: SummaryMatchesText;
  riskFlags?: RiskFlag[];
  criticalArticles?: CriticalArticle[];
  analysisPayload?: Record<string, unknown>;
};

type VoteLlmResult = {
  classification: PublicVoteClassification;
  rawClassification?: string;
  severity: PublicVoteSeverity;
  publicInterestVote: PublicInterestVote;
  confidence: number;
  isProceduralVote?: boolean;
  legislativeType?: LegislativeType;
  decisionNature?: DecisionNature;
  decisionScope?: DecisionScope;
  voteObjectType?: VoteObjectType;
  voteObjectSubtype?: VoteObjectSubtype;
  voteObjectDescription?: string;
  yesMeans?: string;
  noMeans?: string;
  voteObjectTextFound?: boolean;
  primaryTextUsed?: PrimaryTextUsed;
  usedRelatedBillAsMainEvidence?: boolean;
  analyzedTextMatchesVoteObject?: SummaryMatchesText;
  scoreImpactLimit?: ScoreImpactLimit;
  recommendedScoreImpact?: number;
  scoreSafetyReason?: string;
  modelRecommendation?: ModelRecommendation;
  modelUsed?: string;
  modelRole?: ModelRole;
  riskLevel?: RiskLevel;
  analysisStatus?: AnalysisStatus;
  affectsScore?: boolean;
  scorePoints?: number | null;
  needsStrongReview?: boolean;
  reviewReason?: string;
  coverageCategory?: CoverageCategory;
  declaredBenefit?: string;
  hiddenCost?: string;
  netPublicEffect?: NetPublicEffect;
  hasTradeoff?: boolean;
  summaryMatchesText?: SummaryMatchesText;
  riskFlags?: RiskFlag[];
  criticalArticles?: CriticalArticle[];
  reason: string;
  analysisMethodVersion?: string;
  analysisPayload?: Record<string, unknown>;
};

type RunStats = {
  proposals: { classified: number; failed: number; skipped: number; metricRows: number };
  votes: { classified: number; failed: number; skipped: number; metricRows: number; linksUpdated: number };
};

type ModelSelection = {
  provider: ReturnType<typeof getProvider>;
  model: string;
};

type StrongReviewConfig = {
  enabled: boolean;
  provider?: ReturnType<typeof getProvider>;
  model?: string;
};
type EligibilityCounts = {
  votes: { total: number; classified: number; improvable: number; overwrite: number };
  proposals: { total: number; classified: number; improvable: number; overwrite: number };
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

function isStatementTimeout(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLocaleLowerCase("pt-BR").includes("statement timeout") ||
    message.toLocaleLowerCase("pt-BR").includes("canceling statement due to statement timeout");
}

async function fetchByIdsBatch<T extends Row>(
  table: string,
  batch: string[],
  select: string,
  column: string,
  orderColumn: string,
): Promise<T[]> {
  const rows: T[] = [];
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
  return rows;
}

async function fetchByIds<T extends Row>(table: string, ids: string[], select = "*", column = "id", batchSize = BATCH_SIZE) {
  const rows: T[] = [];
  if (ids.length === 0) return rows;
  const orderColumn = table === "proposal_classifications" ? "proposal_id" : "id";
  for (const batch of chunks(ids, batchSize)) {
    try {
      rows.push(...await fetchByIdsBatch<T>(table, batch, select, column, orderColumn));
    } catch (error) {
      if (!isStatementTimeout(error) || batch.length === 1) throw error;
      console.log(terminal.warning(`  ⚠ Timeout lendo ${table}; reduzindo lote de ${batch.length} para consultas individuais.`));
      for (const id of batch) {
        rows.push(...await fetchByIdsBatch<T>(table, [id], select, column, orderColumn));
      }
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

async function assertClassificationRunSchema() {
  const checks = [
    supabase.from("classification_runs").select("id, status, total_items").limit(1),
    supabase.from("classification_run_items").select("run_id, target, item_id, status").limit(1),
  ];
  const results = await Promise.all(checks);
  const error = results.find((result) => result.error)?.error;
  if (!error) return;
  throw new Error(
    [
      "O banco ainda não tem as tabelas de retomada do classificador.",
      "Aplique a migration cockroach/migrations/000001_initial_schema.sql antes de rodar o script.",
      `Erro do banco: ${error.message}`,
    ].join("\n"),
  );
}

async function assertLegislativeImpactSchema() {
  const checks = [
    supabase
      .from("vote_classifications")
      .select("analysis_method_version, legislative_type, vote_object_type, score_impact_limit, analysis_payload")
      .limit(1),
    supabase
      .from("proposal_classifications")
      .select("analysis_method_version, legislative_type, net_public_effect, analysis_payload")
      .limit(1),
  ];
  const results = await Promise.all(checks);
  const error = results.find((result) => result.error)?.error;
  if (!error) return;

  throw new Error(
    [
      "O banco ainda não tem as colunas principais da metodologia N3.",
      "Aplique a migration cockroach/migrations/000001_initial_schema.sql antes de rodar nível 3.",
      `Erro do banco: ${error.message}`,
    ].join("\n"),
  );
}

function errorKind(error: unknown) {
  const message = errorMessage(error).toLocaleLowerCase("pt-BR");
  if (message.includes("insufficient_quota") || message.includes("exceeded your current quota")) {
    return "insufficient_quota";
  }
  if (message.includes("429") || message.includes("rate limit") || message.includes("too many requests")) {
    return "rate_limit";
  }
  if (message.includes("json")) return "invalid_json";
  if (message.includes("api")) return "api_error";
  return "unknown";
}

function isHardQuotaError(error: unknown) {
  return errorKind(error) === "insufficient_quota";
}

async function latestClassificationRun() {
  const { data, error } = await supabase
    .from("classification_runs")
    .select("*")
    .in("status", ["pending", "running", "paused", "failed"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to read classification_runs: ${error.message}`);
  return data as ClassificationRunRow | null;
}

async function readClassificationRun(runId: string) {
  const { data, error } = await supabase
    .from("classification_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (error) throw new Error(`Failed to read classification_runs: ${error.message}`);
  return data as ClassificationRunRow;
}

function runSummary(run: ClassificationRunRow | null) {
  if (!run) return "nenhuma execução incompleta encontrada";
  return [
    `${run.id.slice(0, 8)} · ${run.status}`,
    `alvo ${run.target}`,
    `N${run.analysis_level}`,
    `${run.classified_count}/${run.total_items} concluídos`,
    `${run.failed_count} falhas`,
    `${run.pending_count} pendentes`,
    `leve ${run.provider ?? "sem provider"} / ${run.model ?? "sem modelo"}`,
    run.strong_review_enabled ? `forte ${run.strong_provider ?? "sem provider"} / ${run.strong_model ?? "sem modelo"}` : "forte desativado",
    new Date(run.updated_at).toLocaleString("pt-BR"),
  ].join(" · ");
}

async function createClassificationRun(params: {
  target: ClassifyTarget;
  level: AnalysisLevel;
  scope: ClassifyScope;
  limit: number;
  concurrency: number;
  postProcessMode: PostProcessMode;
  provider?: ProviderId;
  model?: string;
  strongReview?: {
    enabled: boolean;
    provider?: ProviderId;
    model?: string;
  };
}) {
  const { data, error } = await supabase
    .from("classification_runs")
    .insert({
      target: params.target,
      analysis_level: params.level,
      scope: params.scope,
      limit_per_target: params.limit,
      concurrency: params.concurrency,
      post_process_mode: params.postProcessMode,
      provider: params.provider ?? null,
      model: params.model ?? null,
      strong_review_enabled: params.strongReview?.enabled ?? false,
      strong_provider: params.strongReview?.enabled ? params.strongReview.provider ?? null : null,
      strong_model: params.strongReview?.enabled ? params.strongReview.model ?? null : null,
      method_version: params.level === 3 ? VOTE_METHODOLOGY_VERSION : publicValueClassificationMetadata().methodologyVersion,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create classification_runs: ${error.message}`);
  return data as ClassificationRunRow;
}

async function updateRunStatus(runId: string, status: ClassificationRunStatus, lastError?: string) {
  const now = new Date().toISOString();
  const patch: Row = {
    status,
    updated_at: now,
    last_error: lastError ?? null,
  };
  if (status === "running") patch.started_at = now;
  if (status === "paused") patch.paused_at = now;
  if (status === "completed" || status === "failed" || status === "cancelled") patch.finished_at = now;
  const { error } = await supabase.from("classification_runs").update(patch).eq("id", runId);
  if (error) throw new Error(`Failed to update classification_runs: ${error.message}`);
}

async function finishRunIfNotPaused(runId: string) {
  const run = await readClassificationRun(runId);
  if (run.status === "paused") return run;
  const counts = await refreshRunCounts(runId);
  const status: ClassificationRunStatus = counts.pending_count > 0 || counts.processing_count > 0
    ? "paused"
    : counts.failed_count > 0
      ? "failed"
      : "completed";
  await updateRunStatus(runId, status, counts.failed_count > 0 ? `${counts.failed_count} itens falharam.` : undefined);
  return readClassificationRun(runId);
}

async function refreshRunCounts(runId: string) {
  const items = await fetchByIds<ClassificationRunItemRow>(
    "classification_run_items",
    [runId],
    "run_id, status",
    "run_id",
  );
  const count = (status: ClassificationRunItemStatus) => items.filter((item) => item.status === status).length;
  const patch = {
    total_items: items.length,
    pending_count: count("pending"),
    processing_count: count("processing"),
    classified_count: count("classified"),
    failed_count: count("failed"),
    skipped_count: count("skipped"),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("classification_runs").update(patch).eq("id", runId);
  if (error) throw new Error(`Failed to refresh classification_runs counts: ${error.message}`);
  return patch;
}

async function upsertRunItems(runId: string, items: Array<{ target: "votes" | "proposals"; itemId: string; itemLabel?: string }>) {
  await upsertBatches(
    "classification_run_items",
    items.map((item) => ({
      run_id: runId,
      target: item.target,
      item_id: item.itemId,
      item_label: item.itemLabel ?? item.itemId,
      status: "pending",
      error_kind: null,
      error_message: null,
      duration_ms: null,
      updated_at: new Date().toISOString(),
    })),
    "run_id,target,item_id",
  );
  await refreshRunCounts(runId);
}

async function fetchRunItems(
  runId: string,
  target: "votes" | "proposals",
  statuses: ClassificationRunItemStatus[],
) {
  const { data, error } = await supabase
    .from("classification_run_items")
    .select("id, run_id, target, item_id, item_label, status, error_kind, error_message, attempts, duration_ms")
    .eq("run_id", runId)
    .eq("target", target)
    .in("status", statuses)
    .order("id");
  if (error) throw new Error(`Failed to read classification_run_items: ${error.message}`);
  return (data ?? []) as ClassificationRunItemRow[];
}

async function markRunItemProcessing(item: ClassificationRunItemRow) {
  const { data, error } = await supabase
    .from("classification_run_items")
    .update({
      status: "processing",
      attempts: item.attempts + 1,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("run_id", item.run_id)
    .eq("target", item.target)
    .eq("item_id", item.item_id)
    .select("id")
    .single();
  if (error) throw new Error(`Failed to mark run item processing: ${error.message}`);
  if (!data) throw new Error(`Failed to mark run item processing: item ${item.run_id}/${item.target}/${item.item_id} not found`);
}

async function markRunItemDone(item: ClassificationRunItemRow, status: "classified" | "failed" | "skipped", params: {
  durationMs: number;
  error?: unknown;
}) {
  const { data, error } = await supabase
    .from("classification_run_items")
    .update({
      status,
      error_kind: params.error ? errorKind(params.error) : null,
      error_message: params.error ? errorMessage(params.error) : null,
      duration_ms: Math.round(params.durationMs),
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("run_id", item.run_id)
    .eq("target", item.target)
    .eq("item_id", item.item_id)
    .select("id")
    .single();
  if (error) throw new Error(`Failed to mark run item ${status}: ${error.message}`);
  if (!data) throw new Error(`Failed to mark run item ${status}: item ${item.run_id}/${item.target}/${item.item_id} not found`);
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

async function getEligibilityCounts(level: AnalysisLevel): Promise<EligibilityCounts> {
  const [votes, voteClassifications, proposals, proposalClassifications] = await Promise.all([
    fetchAll<{ id: string }>("votes", "id"),
    fetchAll<{ vote_id: string; source: string | null; analysis_level: number | null }>(
      "vote_classifications",
      "vote_id, source, analysis_level",
    ),
    fetchAll<{ id: string }>("proposals", "id"),
    fetchAll<{ proposal_id: string; source: string | null; analysis_level: number | null }>(
      "proposal_classifications",
      "proposal_id, source, analysis_level",
      "proposal_id",
    ),
  ]);

  const voteMap = new Map(voteClassifications.map((row) => [row.vote_id, row]));
  const proposalMap = new Map(proposalClassifications.map((row) => [row.proposal_id, row]));

  return {
    votes: {
      total: votes.length,
      classified: voteClassifications.length,
      improvable: votes.filter((vote) => shouldClassify(voteMap.get(vote.id), level, "improvable")).length,
      overwrite: votes.filter((vote) => shouldClassify(voteMap.get(vote.id), level, "overwrite")).length,
    },
    proposals: {
      total: proposals.length,
      classified: proposalClassifications.length,
      improvable: proposals.filter((proposal) => shouldClassify(proposalMap.get(proposal.id), level, "improvable")).length,
      overwrite: proposals.filter((proposal) => shouldClassify(proposalMap.get(proposal.id), level, "overwrite")).length,
    },
  };
}

function printEligibilityCounts(target: ClassifyTarget, counts: EligibilityCounts) {
  const rows = target === "both"
    ? [["Votações", counts.votes], ["Proposições", counts.proposals]] as const
    : target === "votes"
      ? [["Votações", counts.votes]] as const
      : [["Proposições", counts.proposals]] as const;

  console.log("\nQuantidade elegível neste nível:");
  for (const [label, row] of rows) {
    console.log(`  ${label}: ${row.total} totais, ${row.classified} já classificadas`);
    console.log(`    Pendentes/melhoráveis: ${row.improvable}`);
    console.log(`    Sobrescrever mesmo nível/inferior: ${row.overwrite}`);
  }
}

async function prepareRunItemsForNewRun(params: {
  runId: string;
  target: ClassifyTarget;
  level: AnalysisLevel;
  scope: ClassifyScope;
  limit: number;
}) {
  const items: Array<{ target: "votes" | "proposals"; itemId: string; itemLabel?: string }> = [];

  if (params.target === "votes" || params.target === "both") {
    const [votes, existing] = await Promise.all([
      fetchAll<VoteRow>("votes", "id, vote_date, description, summary, url, session_number"),
      fetchAll<{ vote_id: string; source: string | null; analysis_level: number | null }>(
        "vote_classifications",
        "vote_id, source, analysis_level",
      ),
    ]);
    const existingMap = new Map(existing.map((row) => [row.vote_id, row]));
    const candidates = votes
      .filter((vote) => shouldClassify(existingMap.get(vote.id), params.level, params.scope))
      .slice(0, params.limit);
    items.push(...candidates.map((vote) => ({
      target: "votes" as const,
      itemId: vote.id,
      itemLabel: shortText(vote.description || vote.id, 120),
    })));
  }

  if (params.target === "proposals" || params.target === "both") {
    const [proposals, existing] = await Promise.all([
      fetchAll<ProposalRow>("proposals", "id, type, number, year, proposal_date, summary, status, url"),
      fetchAll<{ proposal_id: string; source: string | null; analysis_level: number | null }>(
        "proposal_classifications",
        "proposal_id, source, analysis_level",
        "proposal_id",
      ),
    ]);
    const existingMap = new Map(existing.map((row) => [row.proposal_id, row]));
    const candidates = proposals
      .filter((proposal) => shouldClassify(existingMap.get(proposal.id), params.level, params.scope))
      .slice(0, params.limit);
    items.push(...candidates.map((proposal) => ({
      target: "proposals" as const,
      itemId: proposal.id,
      itemLabel: `${proposal.type ?? "Proposição"} ${proposal.number ?? proposal.id}/${proposal.year ?? ""}`.replace(/\/$/, ""),
    })));
  }

  await upsertRunItems(params.runId, items);
  return items.length;
}

function cleanJson(text: string) {
  const stripped = text.replace(/```json\s*|\s*```/g, "").trim();
  const start = stripped.indexOf("{");
  if (start < 0) return stripped;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < stripped.length; index++) {
    const char = stripped[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return stripped.slice(start, index + 1);
  }

  return stripped;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function clampConfidence(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.75;
  return Math.min(1, Math.max(0, parsed));
}

function normalizeProposalCategory(value: unknown): PublicValueCategory | null {
  const categories = Object.keys(PUBLIC_VALUE_CATEGORIES) as PublicValueCategory[];
  if (typeof value !== "string") return null;
  if ((categories as string[]).includes(value)) return value as PublicValueCategory;
  const matches = categories.filter((category) => value.split("|").map((part) => part.trim()).includes(category));
  return matches[0] ?? null;
}

function truncatePrompt(prompt: string, model: string) {
  const contextLimit = detectContextLimit(model);
  const tokens = estimateTokens(prompt);
  if (tokens <= contextLimit * 0.8) return prompt;
  const maxChars = Math.floor(contextLimit * 0.75 * 4);
  const headChars = Math.floor(maxChars * 0.65);
  const tailChars = maxChars - headChars;
  return [
    prompt.slice(0, headChars),
    "\n\n[... TEXTO TRUNCADO por limite de contexto; mantendo instruções finais e schema JSON ...]\n\n",
    prompt.slice(-tailChars),
  ].join("");
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
  const legislativeType = inferLegislativeType(`${proposal.type ?? ""} ${proposal.summary ?? ""}`);
  const fullTextBlock = level === 3 && fullText
    ? `\nTEXTO INTEGRAL DA PROPOSIÇÃO:\n${fullText.text}\n`
    : "";
  if (level === 3) {
    return `Você é um analista legislativo técnico, imparcial e conservador na classificação.
Avalie a proposição pelo impacto público real, não pela promessa da ementa.
Não favoreça partido, governo, oposição, ideologia, autor, categoria profissional ou grupo econômico.
Quando houver texto integral, analise artigos, parágrafos, incisos, exceções, revogações e disposições transitórias.
${fullTextBlock}
DADOS OFICIAIS:
ID: ${proposal.id}
Tipo: ${proposal.type ?? ""} ${proposal.number ?? ""}/${proposal.year ?? ""}
Tipo legislativo inferido: ${legislativeType}
Data: ${proposal.proposal_date ?? ""}
Ementa: ${proposal.summary ?? ""}
Situação: ${proposal.status ?? ""}

Antes de classificar, identifique benefício declarado, custo escondido, trade-off, efeito público líquido, se a ementa combina com o texto e artigos críticos.
Se o texto for insuficiente, reduza confiança e use netPublicEffect = "unclear".

Categorias: "anti_corruption" | "public_transparency" | "waste_reduction" | "health" | "education" | "security" | "infrastructure" | "jobs_economy" | "state_modernization" | "technology_innovation" | "deregulation" | "tribute" | "commemorative_date" | "motion" | "place_naming".

Retorne APENAS JSON válido:
{
  "analysisMethodVersion": "legislative-impact-v2",
  "category": "anti_corruption",
  "confidence": "medium",
  "legislativeType": "REQ",
  "decisionNature": "oversight_control",
  "decisionScope": "oversight",
  "declaredBenefit": "Benefício aparente da proposta.",
  "hiddenCost": "Custo escondido, exceção, revogação ou efeito colateral relevante.",
  "netPublicEffect": "positive",
  "hasTradeoff": true,
  "summaryMatchesText": "true",
  "riskFlags": ["none"],
  "criticalArticles": [{ "article": "Art. X", "issue": "Explicação curta do ponto de atenção." }],
  "justification": "Explicação curta em português com critério principal, benefício aparente, riscos, trade-offs e efeito líquido."
}

Use exatamente UM valor em "category". Nunca responda "categoria1 | categoria2" nem lista de categorias.`;
  }
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
  "category": "anti_corruption",
  "confidence": "medium",
  "justification": "Explicação curta e simples em português, com 1 ou 2 frases, dizendo o critério principal e por que a proposição se enquadra nessa categoria."
}

Use exatamente UM valor em "category". Nunca responda "categoria1 | categoria2" nem lista de categorias.`;
}

function votePrompt(vote: VoteRow, level: AnalysisLevel, fullText?: FullTextResult) {
  const legislativeType = inferLegislativeType(`${vote.description ?? ""} ${vote.summary ?? ""}`);
  const voteObjectType = inferVoteObjectType(vote.description);
  const voteObjectSubtype = inferVoteObjectSubtype(vote.description);
  const voteObjectTextFound = voteObjectType === "main_bill" && Boolean(fullText);
  const primaryTextUsed = voteObjectTextFound ? "vote_object" : fullText ? "related_bill" : "summary_only";
  const fullTextBlock = level === 3 && fullText
    ? `\nTEXTO OU RESUMO DA PROPOSIÇÃO RELACIONADA, APENAS COMO CONTEXTO:\n${fullText.text}\n`
    : "";
  if (level === 3) {
    return `Você é um classificador legislativo conservador em modo econômico com modelo mini. Retorne somente um objeto JSON válido.
Metodologia: legislative-impact-v4-mini-first-safe-score.

Objetivo:
1. Identificar o objeto real da votação.
2. Dizer o que o voto SIM fazia na prática.
3. Dizer o que o voto NÃO fazia na prática.
4. Classificar o efeito público com cautela.
5. Marcar casos que precisam de revisão avançada.
6. Não forçar pontuação quando houver ambiguidade.

Regras obrigatórias:
- Não julgue partido, governo, oposição ou ideologia.
- Não use intenção presumida do parlamentar.
- Não confunda projeto principal com emenda, destaque, substitutivo ou requerimento.
- Se for urgência, retirada de pauta, adiamento, recurso, destaque ou requerimento, classifique como procedimental ou objeto específico.
- Procedimental não deve receber impacto alto.
- Se a votação for emenda, destaque, substitutivo ou votação em separado e o texto específico não estiver disponível, marque needsStrongReview = true.
- Se o texto não permitir saber o mérito, use netPublicEffect = "insufficient" ou "unclear".
- Se houver benefício e risco relevante, use netPublicEffect = "mixed".
- Penalidade ou bônus só pode ocorrer com impacto claro, objeto claro e confidence >= 0.85.
- Em caso de dúvida, escolha sem pontuação e needsStrongReview = true.
- O mini não deve recomendar score alto em caso sensível.
${fullTextBlock}
DADOS OFICIAIS DA VOTAÇÃO:
ID: ${vote.id}
Data: ${vote.vote_date ?? ""}
Descrição oficial: ${vote.description ?? ""}
Resumo da proposição associada: ${vote.summary ?? ""}
Tipo legislativo inferido: ${legislativeType}
Objeto da votação inferido: ${voteObjectType}
Subtipo inferido: ${voteObjectSubtype}
Texto específico do objeto votado encontrado: ${voteObjectTextFound ? "sim" : "não"}
Texto primário disponível nesta chamada: ${primaryTextUsed}

TEXTO ESPECÍFICO DO OBJETO VOTADO:
NAO DISPONIVEL

Retorne APENAS JSON válido neste formato:
{
  "analysisMethodVersion": "legislative-impact-v4-mini-first-safe-score",
  "modelRole": "triage",
  "classification": "positive_public_interest | neutral | low_relevance | negative_public_interest | harmful_or_self_serving | insufficient",
  "severity": "low | medium | high | critical",
  "publicInterestVote": "yes | no | any | none | indeterminate",
  "confidence": 0.0,
  "isProceduralVote": true,
  "legislativeType": "PL | PLP | PEC | PDL | PRC | MPV | RIC | PFC | REQ | EMP | SBT | DTQ | VTS | RCP | MSC | INC | OUTRO | INCERTO",
  "decisionNature": "substantive_policy | constitutional_change | fiscal_budgetary | oversight_control | information_request | criminal_penalty | rights_expansion | rights_restriction | institutional_rule | symbolic | commemorative | procedural | unclear",
  "decisionScope": "national_policy | constitutional_rule | fiscal_effect | criminal_law | administrative_control | congressional_procedure | oversight | symbolic_only | local_or_specific | unclear",
  "voteObjectType": "main_bill | amendment | substitute | highlight | separate_vote | urgency | procedural_request | postponement | agenda_withdrawal | appeal | symbolic | fiscalization | other | unclear",
  "voteObjectSubtype": "amendment | substitute | request | main_bill | none | unclear",
  "voteObjectDescription": "Objeto exato da votação.",
  "yesMeans": "O que votar sim aprovava, mantinha, acelerava ou apoiava.",
  "noMeans": "O que votar não rejeitava, bloqueava, mantinha fora ou impedia.",
  "voteObjectTextFound": false,
  "primaryTextUsed": "vote_object | related_bill | summary_only | unknown",
  "usedRelatedBillAsMainEvidence": true,
  "analyzedTextMatchesVoteObject": "true | false | unclear",
  "scoreImpactLimit": "none | low | medium | high | critical",
  "recommendedScoreImpact": 0,
  "declaredBenefit": "Benefício aparente ou declarado.",
  "hiddenCost": "Custo escondido, exceção, revogação, trade-off ou efeito colateral.",
  "netPublicEffect": "positive | negative | mixed | neutral | unclear | insufficient",
  "hasTradeoff": true,
  "summaryMatchesText": "true | false | unclear",
  "riskLevel": "low | medium | high | critical",
  "needsStrongReview": true,
  "analysisStatus": "validated | neutral_validated | pending_strong_review | insufficient_data | mixed_requires_review | procedural_low_confidence | not_eligible | failed_parsing",
  "affectsScore": false,
  "scorePoints": null,
  "reviewReason": "Motivo curto para revisão avançada ou para não precisar dela.",
  "coverageCategory": "scored | neutral_analyzed | pending_review | insufficient | not_eligible",
  "riskFlags": ["benefit_offset_by_hidden_cost | hidden_revocation | scope_mismatch | unrelated_amendment | jabuti | privilege_or_benefit | corporate_or_category_benefit | economic_group_benefit | fiscal_impact | transparency_reduction | oversight_reduction | constitutional_risk | increased_workload | increased_cost_or_tax | increased_bureaucracy | reduced_rights | procedural_only | vote_object_unclear | text_does_not_match_vote_object | insufficient_vote_object_text | hidden_exception | sector_specific_benefit | insufficient_text | none"],
  "criticalArticles": [{ "article": "Art. X", "appearsInVoteObjectText": true, "issue": "Explicação curta do ponto de atenção." }],
  "scoreSafetyReason": "Motivo curto para zerar, limitar ou permitir impacto no score.",
  "reason": "Explicação curta em português dizendo objeto, sim/não, benefício aparente, custo escondido, efeito líquido e voto alinhado ou bloqueio de score."
}`;
  }
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

function strongVotePrompt(vote: VoteRow, fullText: FullTextResult | undefined, triage: VoteLlmResult) {
  return votePrompt(vote, 3, fullText)
    .replace(
      "Você é um classificador legislativo conservador em modo econômico com modelo mini.",
      "Você é um revisor legislativo avançado e conservador usando modelo forte.",
    )
    .replace("5. Marcar casos que precisam de revisão avançada.", "5. Resolver somente os casos que tenham evidência textual suficiente.")
    .replace("6. Não forçar pontuação quando houver ambiguidade.", "6. Manter pendente/null quando ainda houver ambiguidade.")
    .replace("- Penalidade ou bônus só pode ocorrer com impacto claro, objeto claro e confidence >= 0.85.", "- Penalidade ou bônus só pode ocorrer com impacto claro, objeto claro, texto compatível e confidence >= 0.70.")
    .replace("- Em caso de dúvida, escolha sem pontuação e needsStrongReview = true.", "- Em caso de dúvida, mantenha sem pontuação e needsStrongReview = true.")
    .replace("- O mini não deve recomendar score alto em caso sensível.", "- O modelo forte também não deve pontuar quando o texto específico do objeto votado não estiver disponível.")
    .replace('"modelRole": "triage"', '"modelRole": "strong_review"')
    .replace(
      "Retorne APENAS JSON válido neste formato:",
      `TRIAGEM LEVE JÁ FEITA:
${JSON.stringify({
  classification: triage.classification,
  publicInterestVote: triage.publicInterestVote,
  confidence: triage.confidence,
  voteObjectType: triage.voteObjectType,
  voteObjectDescription: triage.voteObjectDescription,
  netPublicEffect: triage.netPublicEffect,
  needsStrongReview: triage.needsStrongReview,
  reviewReason: triage.reviewReason,
  scoreSafetyReason: triage.scoreSafetyReason,
  reason: triage.reason,
}).slice(0, 4_000)}

Retorne APENAS JSON válido neste formato:`,
    );
}

function parseProposalResult(text: string): ProposalLlmResult {
  const parsed = JSON.parse(cleanJson(text)) as Partial<ProposalLlmResult>;
  const category = normalizeProposalCategory(parsed.category);
  if (!category) {
    throw new Error(`categoria inválida: ${parsed.category}`);
  }
  if (!["high", "medium", "low"].includes(String(parsed.confidence))) {
    throw new Error(`confiança inválida: ${parsed.confidence}`);
  }
  if (!parsed.justification || parsed.justification.length < 10) {
    throw new Error("justificativa ausente ou curta demais");
  }
  const result = normalizeProposalAnalysis({
    category,
    confidence: parsed.confidence,
    justification: parsed.justification,
    source: "llm",
    analysisLevel: 3,
    methodologyVersion: "legislative-impact-v2",
    analysisMethodVersion: parsed.analysisMethodVersion,
    legislativeType: parsed.legislativeType,
    decisionNature: parsed.decisionNature,
    decisionScope: parsed.decisionScope,
    declaredBenefit: parsed.declaredBenefit,
    hiddenCost: parsed.hiddenCost,
    netPublicEffect: parsed.netPublicEffect,
    hasTradeoff: parsed.hasTradeoff,
    summaryMatchesText: parsed.summaryMatchesText,
    riskFlags: parsed.riskFlags,
    criticalArticles: parsed.criticalArticles,
    analysisPayload: parsed as Record<string, unknown>,
  });
  return { ...result, analysisPayload: parsed as Record<string, unknown> };
}

function parseVoteResult(text: string): VoteLlmResult {
  const parsed = JSON.parse(cleanJson(text)) as Partial<VoteLlmResult>;
  const classifications = ["positive_public_interest", "neutral", "low_relevance", "negative_public_interest", "harmful_or_self_serving"];
  const rawClassification = String((parsed as Partial<VoteLlmResult> & { classification?: string }).classification ?? "");
  const severities = ["low", "medium", "high", "critical"];
  const publicVotes = ["yes", "no", "any", "none", "indeterminate"];
  const storedClassification = rawClassification === "insufficient" ? "neutral" : rawClassification;
  if (!storedClassification || !classifications.includes(storedClassification)) {
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
  const result = normalizeVoteAnalysis({
    voteId: "",
    classification: storedClassification as PublicVoteClassification,
    severity: parsed.severity,
    publicInterestVote: parsed.publicInterestVote,
    confidence: clampConfidence(parsed.confidence),
    isProceduralVote: parsed.isProceduralVote,
    legislativeType: parsed.legislativeType,
    decisionNature: parsed.decisionNature,
    decisionScope: parsed.decisionScope,
    voteObjectType: parsed.voteObjectType,
    voteObjectSubtype: parsed.voteObjectSubtype,
    voteObjectDescription: parsed.voteObjectDescription,
    yesMeans: parsed.yesMeans,
    noMeans: parsed.noMeans,
    voteObjectTextFound: parsed.voteObjectTextFound,
    primaryTextUsed: parsed.primaryTextUsed,
    usedRelatedBillAsMainEvidence: parsed.usedRelatedBillAsMainEvidence,
    analyzedTextMatchesVoteObject: parsed.analyzedTextMatchesVoteObject,
    scoreImpactLimit: parsed.scoreImpactLimit,
    recommendedScoreImpact: parsed.recommendedScoreImpact,
    scoreSafetyReason: parsed.scoreSafetyReason,
    modelRecommendation: parsed.modelRecommendation,
    modelUsed: parsed.modelUsed,
    modelRole: parsed.modelRole,
    riskLevel: parsed.riskLevel,
    analysisStatus: parsed.analysisStatus,
    affectsScore: parsed.affectsScore,
    scorePoints: parsed.scorePoints,
    needsStrongReview: parsed.needsStrongReview,
    reviewReason: parsed.reviewReason,
    coverageCategory: parsed.coverageCategory,
    declaredBenefit: parsed.declaredBenefit,
    hiddenCost: parsed.hiddenCost,
    netPublicEffect: parsed.netPublicEffect,
    hasTradeoff: parsed.hasTradeoff,
    summaryMatchesText: parsed.summaryMatchesText,
    riskFlags: parsed.riskFlags,
    criticalArticles: parsed.criticalArticles,
    reason: parsed.reason,
    source: "llm",
    analysisLevel: 3,
    reviewedManually: false,
    methodologyVersion: VOTE_METHODOLOGY_VERSION,
    analysisMethodVersion: parsed.analysisMethodVersion,
    analysisPayload: { ...(parsed as Record<string, unknown>), rawClassification },
  });
  return { ...result, rawClassification, analysisPayload: { ...(parsed as Record<string, unknown>), rawClassification } };
}

function finalizeVoteResult(
  parsed: VoteLlmResult,
  vote: VoteRow,
  model: string,
  fullText?: FullTextResult,
  options: {
    modelRole?: ModelRole;
    previousAnalysis?: VoteLlmResult;
  } = {},
): VoteLlmResult {
  const modelRole = options.modelRole ?? parsed.modelRole ?? "triage";
  const minConfidence = modelRole === "strong_review" ? 0.7 : 0.85;
  const riskBlockReason = modelRole === "strong_review"
    ? "Risco alto/crítico mesmo após revisão forte."
    : "Risco alto detectado. Mini não pode aplicar pontuação.";
  const fallbackObjectType = inferVoteObjectType(vote.description);
  const fallbackSubtype = inferVoteObjectSubtype(vote.description);
  const voteObjectType = parsed.voteObjectType ?? fallbackObjectType;
  const voteObjectSubtype = parsed.voteObjectSubtype ?? fallbackSubtype;
  const specificObject = isSpecificVoteObject(voteObjectType);
  const defaultVoteObjectTextFound = voteObjectType === "main_bill" && Boolean(fullText);
  const defaultPrimaryTextUsed: PrimaryTextUsed = defaultVoteObjectTextFound ? "vote_object" : fullText ? "related_bill" : "summary_only";
  const primaryTextUsed: PrimaryTextUsed = parsed.primaryTextUsed ?? defaultPrimaryTextUsed;
  const voteObjectTextFound = parsed.voteObjectTextFound ?? defaultVoteObjectTextFound;
  const usedRelatedBillAsMainEvidence = parsed.usedRelatedBillAsMainEvidence ?? primaryTextUsed === "related_bill";
  const riskFlags = new Set<RiskFlag>(parsed.riskFlags ?? []);
  if (riskFlags.size === 0) riskFlags.add("none");

  let publicInterestVote = parsed.publicInterestVote;
  let scoreImpactLimit = parsed.scoreImpactLimit ?? "low";
  let recommendedScoreImpact = parsed.recommendedScoreImpact ?? 0;
  let confidence = clampConfidence(parsed.confidence);
  let scoreSafetyReason = parsed.scoreSafetyReason ?? "";
  let analyzedTextMatchesVoteObject = parsed.analyzedTextMatchesVoteObject ?? "unclear";
  let riskLevel = parsed.riskLevel ?? "low";
  let needsStrongReview = parsed.needsStrongReview ?? false;
  let analysisStatus = parsed.analysisStatus ?? "validated";
  let affectsScore = parsed.affectsScore ?? true;
  let scorePoints = parsed.scorePoints ?? recommendedScoreImpact;
  let reviewReason = parsed.reviewReason ?? "Não precisa revisão avançada.";
  let coverageCategory = parsed.coverageCategory ?? "scored";

  if (specificObject && (!voteObjectTextFound || primaryTextUsed !== "vote_object" || usedRelatedBillAsMainEvidence)) {
    riskFlags.delete("none");
    riskFlags.add("scope_mismatch");
    riskFlags.add("insufficient_vote_object_text");
    publicInterestVote = publicInterestVote === "yes" || publicInterestVote === "no" ? "indeterminate" : publicInterestVote;
    scoreImpactLimit = "none";
    recommendedScoreImpact = 0;
    scorePoints = null;
    affectsScore = false;
    needsStrongReview = true;
    analysisStatus = "pending_strong_review";
    coverageCategory = "pending_review";
    riskLevel = riskLevel === "critical" ? "critical" : "high";
    confidence = Math.min(confidence, 0.55);
    analyzedTextMatchesVoteObject = analyzedTextMatchesVoteObject === "true" ? "unclear" : analyzedTextMatchesVoteObject;
    reviewReason = "Texto específico do objeto votado não foi encontrado; requer revisão avançada.";
    scoreSafetyReason ||= reviewReason;
  }

  if (parsed.netPublicEffect === "mixed" || parsed.netPublicEffect === "unclear" || parsed.netPublicEffect === "insufficient") {
    scoreImpactLimit = "none";
    recommendedScoreImpact = 0;
    scorePoints = null;
    affectsScore = false;
    needsStrongReview = true;
    analysisStatus = parsed.netPublicEffect === "mixed" ? "mixed_requires_review" : "insufficient_data";
    coverageCategory = parsed.netPublicEffect === "mixed" ? "pending_review" : "insufficient";
    if (publicInterestVote === "yes" || publicInterestVote === "no") publicInterestVote = parsed.netPublicEffect === "mixed" ? "any" : "indeterminate";
    reviewReason = parsed.netPublicEffect === "mixed"
      ? "Efeito público misto. Ambos os votos podem ser defensáveis."
      : "Dados insuficientes para pontuação segura.";
    scoreSafetyReason ||= reviewReason;
  }

  const criticalArticleMismatch = parsed.criticalArticles?.some((article) => article.appearsInVoteObjectText === false) === true;
  if (criticalArticleMismatch) {
    riskFlags.delete("none");
    riskFlags.add("scope_mismatch");
    riskFlags.add("text_does_not_match_vote_object");
    publicInterestVote = "indeterminate";
    scoreImpactLimit = "none";
    recommendedScoreImpact = 0;
    scorePoints = null;
    affectsScore = false;
    needsStrongReview = true;
    analysisStatus = "pending_strong_review";
    coverageCategory = "pending_review";
    riskLevel = riskLevel === "critical" ? "critical" : "high";
    confidence = Math.min(confidence, 0.55);
    reviewReason = "A análise citou artigo que não pertence ao objeto exato votado.";
    scoreSafetyReason ||= reviewReason;
  }

  if (confidence < minConfidence || riskLevel === "high" || riskLevel === "critical") {
    if (analysisStatus === "validated") analysisStatus = "pending_strong_review";
    if (coverageCategory === "scored") coverageCategory = "pending_review";
    needsStrongReview = true;
    affectsScore = false;
    scorePoints = null;
    recommendedScoreImpact = 0;
    scoreImpactLimit = "none";
    reviewReason = confidence < minConfidence
      ? modelRole === "strong_review" ? "Confiança abaixo do mínimo para pontuar mesmo com revisão forte." : "Confiança abaixo do mínimo para pontuar com mini."
      : riskBlockReason;
    scoreSafetyReason ||= reviewReason;
  }

  if (analysisStatus === "neutral_validated") {
    affectsScore = false;
    needsStrongReview = false;
    scorePoints = 0;
    recommendedScoreImpact = 0;
    coverageCategory = "neutral_analyzed";
  }

  const payload = {
    ...(parsed.analysisPayload ?? parsed),
    ...parsed,
    analysisMethodVersion: LEGISLATIVE_IMPACT_V4_VERSION,
    modelRecommendation: modelRole === "strong_review" ? "strong_model_required" : parsed.modelRecommendation ?? "mini_allowed_for_triage",
    modelRole,
    modelUsed: model,
    previousAnalysis: options.previousAnalysis?.analysisPayload ?? options.previousAnalysis,
    voteObjectType,
    voteObjectSubtype,
    voteObjectTextFound,
    primaryTextUsed,
    usedRelatedBillAsMainEvidence,
    analyzedTextMatchesVoteObject,
    publicInterestVote,
    scoreImpactLimit,
    recommendedScoreImpact,
    scorePoints,
    affectsScore,
    analysisStatus,
    needsStrongReview,
    reviewReason,
    coverageCategory,
    riskLevel,
    confidence,
    riskFlags: Array.from(riskFlags),
    scoreSafetyReason,
  } satisfies Record<string, unknown>;

  return {
    ...parsed,
    analysisMethodVersion: LEGISLATIVE_IMPACT_V4_VERSION,
    modelRecommendation: modelRole === "strong_review" ? "strong_model_required" : parsed.modelRecommendation ?? "mini_allowed_for_triage",
    modelRole,
    modelUsed: model,
    voteObjectType,
    voteObjectSubtype,
    voteObjectTextFound,
    primaryTextUsed,
    usedRelatedBillAsMainEvidence,
    analyzedTextMatchesVoteObject,
    publicInterestVote,
    scoreImpactLimit,
    recommendedScoreImpact,
    scorePoints,
    affectsScore,
    analysisStatus,
    needsStrongReview,
    reviewReason,
    coverageCategory,
    riskLevel,
    confidence,
    riskFlags: Array.from(riskFlags),
    scoreSafetyReason,
    analysisPayload: payload,
  };
}

function isSpecificVoteObject(type: VoteObjectType) {
  return type === "amendment" || type === "highlight" || type === "substitute" || type === "separate_vote";
}

async function generateJsonResult<T>(params: {
  provider: ReturnType<typeof getProvider>;
  model: string;
  prompt: string;
  parse: (text: string) => T;
  label: string;
}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0
      ? params.prompt
      : `${params.prompt}

A resposta anterior não foi JSON válido. Responda agora SOMENTE com o objeto JSON solicitado, sem introdução, sem "Entendido", sem markdown e sem comentários fora do JSON.`;
    const response = await params.provider.generateContent(
      truncatePrompt(prompt, params.model),
      { model: params.model, temperature: 0.1, responseMimeType: "application/json" },
    );
    try {
      return params.parse(response);
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        console.log(terminal.warning(`  ⚠ Resposta fora do JSON em ${params.label}; tentando corrigir uma vez.`));
        continue;
      }
      throw new Error(
        `${params.label}: resposta não foi JSON válido após retry (${errorMessage(lastError)}). Trecho: ${shortText(response, 140)}`,
      );
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function jsonArray<T>(value: T[] | undefined) {
  return value && value.length > 0 ? value : [];
}

function proposalAnalysisColumns(parsed: ProposalLlmResult, fallbackType: LegislativeType) {
  return {
    analysis_method_version: parsed.analysisMethodVersion ?? "legislative-impact-v2",
    legislative_type: parsed.legislativeType ?? fallbackType,
    decision_nature: parsed.decisionNature ?? "unclear",
    decision_scope: parsed.decisionScope ?? "unclear",
    declared_benefit: parsed.declaredBenefit ?? "",
    hidden_cost: parsed.hiddenCost ?? "",
    net_public_effect: parsed.netPublicEffect ?? "unclear",
    has_tradeoff: parsed.hasTradeoff ?? false,
    summary_matches_text: parsed.summaryMatchesText ?? "unclear",
    risk_flags: jsonArray(parsed.riskFlags),
    critical_articles: jsonArray(parsed.criticalArticles),
    analysis_payload: parsed.analysisPayload ?? parsed,
  };
}

function voteAnalysisColumns(parsed: VoteLlmResult, fallbackType: LegislativeType, fallbackObjectType: VoteObjectType) {
  return {
    analysis_method_version: parsed.analysisMethodVersion ?? VOTE_METHODOLOGY_VERSION,
    model_used: parsed.modelUsed ?? "",
    model_role: parsed.modelRole ?? "triage",
    analysis_status: parsed.analysisStatus ?? "pending_strong_review",
    risk_level: parsed.riskLevel ?? "low",
    needs_strong_review: parsed.needsStrongReview ?? false,
    review_reason: parsed.reviewReason ?? "",
    coverage_category: parsed.coverageCategory ?? "pending_review",
    affects_score: parsed.affectsScore ?? false,
    score_safety_reason: parsed.scoreSafetyReason ?? "",
    legislative_type: parsed.legislativeType ?? fallbackType,
    decision_nature: parsed.decisionNature ?? "unclear",
    decision_scope: parsed.decisionScope ?? "unclear",
    vote_object_type: parsed.voteObjectType ?? fallbackObjectType,
    vote_object_description: parsed.voteObjectDescription ?? "",
    yes_means: parsed.yesMeans ?? "",
    no_means: parsed.noMeans ?? "",
    analyzed_text_matches_vote_object: parsed.analyzedTextMatchesVoteObject ?? "unclear",
    score_impact_limit: parsed.scoreImpactLimit ?? "low",
    is_procedural_vote: parsed.isProceduralVote ?? false,
    declared_benefit: parsed.declaredBenefit ?? "",
    hidden_cost: parsed.hiddenCost ?? "",
    net_public_effect: parsed.netPublicEffect ?? "unclear",
    has_tradeoff: parsed.hasTradeoff ?? false,
    summary_matches_text: parsed.summaryMatchesText ?? "unclear",
    risk_flags: jsonArray(parsed.riskFlags),
    critical_articles: jsonArray(parsed.criticalArticles),
    analysis_payload: parsed.analysisPayload ?? parsed,
  };
}

function dbPublicInterestVote(value: PublicInterestVote) {
  return value === "indeterminate" ? "none" : value;
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));
  async function next() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, next));
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

async function updateLegislatorVotes(
  analyses: Map<string, PublicVoteAnalysis>,
  options: { label?: string; processed?: number; total?: number } = {},
) {
  if (analyses.size === 0) return new Set<string>();
  const affectedPairs = new Set<string>();
  let processedVotes = 0;
  for (const voteIds of chunks([...analyses.keys()], VOTE_LINK_READ_BATCH_SIZE)) {
    const links = await fetchByIds<LegislatorVoteRow>(
      "legislator_votes",
      voteIds,
      "id, legislator_id, vote_id, period_id, candidate_vote, score_delta, confidence",
      "vote_id",
      VOTE_LINK_READ_BATCH_SIZE,
    );
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
        score_points: record.scorePoints,
        affects_score: record.affectsScore,
        analysis_status: record.analysisStatus,
        needs_strong_review: record.needsStrongReview,
        review_reason: record.reviewReason,
        coverage_category: record.coverageCategory,
        score_safety_reason: record.scoreSafetyReason,
        model_used: record.modelUsed,
        model_role: record.modelRole,
        confidence: record.confidence,
        source: record.source,
        reviewed_manually: record.reviewedManually,
      }];
    });

    await upsertBatches("legislator_votes", rows, "id");
    processedVotes += voteIds.length;
    if (options.label) {
      const done = (options.processed ?? 0) + processedVotes;
      const total = options.total ?? analyses.size;
      console.log(`${options.label}: vínculos atualizados para ${done}/${total} votações; pares afetados até agora: ${affectedPairs.size}`);
    }
  }
  return affectedPairs;
}

async function fetchLegislatorVotesForPairs(affectedPairs: Set<string>) {
  const grouped = new Map<string, Set<number>>();
  for (const key of affectedPairs) {
    const [legislatorId, periodId] = key.split("|");
    const ids = grouped.get(periodId) ?? new Set<number>();
    ids.add(Number(legislatorId));
    grouped.set(periodId, ids);
  }

  const rows: LegislatorVoteRow[] = [];
  for (const [periodId, legislatorIds] of grouped) {
    for (const legislatorBatch of chunks([...legislatorIds], METRIC_LEGISLATOR_READ_BATCH_SIZE)) {
      for (let from = 0; ; from += PAGE_SIZE) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("legislator_votes")
          .select("id, legislator_id, vote_id, period_id, candidate_vote, score_delta, score_points, confidence, affects_score, analysis_status")
          .eq("period_id", periodId)
          .in("legislator_id", legislatorBatch)
          .order("id")
          .range(from, to);
        if (error) throw new Error(`Failed to read legislator_votes: ${error.message}`);
        rows.push(...((data ?? []) as LegislatorVoteRow[]));
        if (!data || data.length < PAGE_SIZE) break;
      }
    }
  }
  return rows;
}

async function updateVoteMetrics(affectedPairs: Set<string>) {
  if (affectedPairs.size === 0) return 0;
  const groups = new Map<string, LegislatorVoteRow[]>();
  const rows = await fetchLegislatorVotesForPairs(affectedPairs);

  for (const row of rows) {
    const hasValidatedStatus = row.analysis_status === "validated" || row.analysis_status === "neutral_validated";
    const hasLegacyAnalysis = !row.analysis_status && row.confidence !== null;
    if (!hasValidatedStatus && !hasLegacyAnalysis) continue;
    const key = pairKey(row.legislator_id, row.period_id);
    if (!affectedPairs.has(key)) continue;
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
      const affectsScore = vote.affects_score === true || (!vote.analysis_status && vote.confidence !== null);
      if (!affectsScore) {
        confidence += Number(vote.confidence ?? 0);
        continue;
      }
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

function voteAnalysisFromClassification(row: VoteClassificationRow): PublicVoteAnalysis {
  const payload = row.analysis_payload ?? {};
  return normalizeVoteAnalysis({
    voteId: row.vote_id,
    classification: row.classification,
    severity: row.severity,
    publicInterestVote: row.public_interest_vote,
    confidence: Number(row.confidence ?? 0),
    isProceduralVote: row.is_procedural_vote ?? false,
    legislativeType: row.legislative_type ?? undefined,
    decisionNature: row.decision_nature ?? undefined,
    decisionScope: row.decision_scope ?? undefined,
    voteObjectType: row.vote_object_type ?? undefined,
    voteObjectSubtype: typeof payload.voteObjectSubtype === "string" ? payload.voteObjectSubtype as VoteObjectSubtype : undefined,
    voteObjectDescription: row.vote_object_description ?? undefined,
    yesMeans: row.yes_means ?? undefined,
    noMeans: row.no_means ?? undefined,
    voteObjectTextFound: typeof payload.voteObjectTextFound === "boolean" ? payload.voteObjectTextFound : undefined,
    primaryTextUsed: typeof payload.primaryTextUsed === "string" ? payload.primaryTextUsed as PrimaryTextUsed : undefined,
    usedRelatedBillAsMainEvidence: typeof payload.usedRelatedBillAsMainEvidence === "boolean" ? payload.usedRelatedBillAsMainEvidence : undefined,
    analyzedTextMatchesVoteObject: row.analyzed_text_matches_vote_object ?? undefined,
    scoreImpactLimit: row.score_impact_limit ?? undefined,
    recommendedScoreImpact: typeof payload.recommendedScoreImpact === "number" ? payload.recommendedScoreImpact : undefined,
    scoreSafetyReason: row.score_safety_reason ?? (typeof payload.scoreSafetyReason === "string" ? payload.scoreSafetyReason : undefined),
    modelRecommendation: typeof payload.modelRecommendation === "string" ? payload.modelRecommendation as ModelRecommendation : undefined,
    modelUsed: row.model_used ?? (typeof payload.modelUsed === "string" ? payload.modelUsed : undefined),
    modelRole: row.model_role ?? (typeof payload.modelRole === "string" ? payload.modelRole as ModelRole : undefined),
    riskLevel: row.risk_level ?? (typeof payload.riskLevel === "string" ? payload.riskLevel as RiskLevel : undefined),
    analysisStatus: row.analysis_status ?? (typeof payload.analysisStatus === "string" ? payload.analysisStatus as AnalysisStatus : undefined),
    affectsScore: row.affects_score ?? (typeof payload.affectsScore === "boolean" ? payload.affectsScore : undefined),
    needsStrongReview: row.needs_strong_review ?? (typeof payload.needsStrongReview === "boolean" ? payload.needsStrongReview : undefined),
    reviewReason: row.review_reason ?? (typeof payload.reviewReason === "string" ? payload.reviewReason : undefined),
    coverageCategory: row.coverage_category ?? (typeof payload.coverageCategory === "string" ? payload.coverageCategory as CoverageCategory : undefined),
    declaredBenefit: row.declared_benefit ?? undefined,
    hiddenCost: row.hidden_cost ?? undefined,
    netPublicEffect: row.net_public_effect ?? undefined,
    hasTradeoff: row.has_tradeoff ?? false,
    summaryMatchesText: row.summary_matches_text ?? undefined,
    riskFlags: row.risk_flags ?? undefined,
    criticalArticles: row.critical_articles ?? undefined,
    reason: row.reason,
    source: row.source,
    analysisLevel: row.analysis_level === 3 ? 3 : 2,
    reviewedManually: row.reviewed_manually ?? false,
    methodologyVersion: row.methodology_version ?? VOTE_METHODOLOGY_VERSION,
    analysisMethodVersion: row.analysis_method_version ?? undefined,
    analysisPayload: payload,
  });
}

async function materializeVoteScores(limit: number) {
  const classifications = await fetchAll<VoteClassificationRow>(
    "vote_classifications",
    "vote_id, classification, severity, public_interest_vote, confidence, reason, source, analysis_level, reviewed_manually, methodology_version, analysis_method_version, legislative_type, decision_nature, decision_scope, vote_object_type, vote_object_description, yes_means, no_means, analyzed_text_matches_vote_object, score_impact_limit, is_procedural_vote, declared_benefit, hidden_cost, net_public_effect, has_tradeoff, summary_matches_text, risk_flags, critical_articles, analysis_payload, model_used, model_role, analysis_status, risk_level, needs_strong_review, review_reason, coverage_category, affects_score, score_safety_reason",
    "vote_id",
  );
  const toProcess = classifications.slice(0, limit);

  console.log(`\nMaterialização: ${classifications.length} classificações disponíveis; processando ${toProcess.length}`);
  console.log("Materialização: atualizando votos dos parlamentares vinculados...");
  const affectedPairs = new Set<string>();
  let processed = 0;
  for (const batch of chunks(toProcess, MATERIALIZE_CLASSIFICATION_BATCH_SIZE)) {
    const analyses = new Map(batch.map((row) => [row.vote_id, voteAnalysisFromClassification(row)]));
    const batchPairs = await updateLegislatorVotes(analyses, {
      label: "Materialização",
      processed,
      total: toProcess.length,
    });
    for (const key of batchPairs) affectedPairs.add(key);
    processed += batch.length;
    console.log(`Materialização: ${processed}/${toProcess.length} votações materializadas; ${affectedPairs.size} pares únicos afetados.`);
  }
  console.log(`Materialização: ${affectedPairs.size} pares parlamentar/período afetados; recalculando métricas...`);
  const metricRows = await updateVoteMetrics(affectedPairs);
  console.log(`Materialização: ${metricRows} linhas de métricas recalculadas.`);
  return { classified: 0, failed: 0, skipped: 0, linksUpdated: affectedPairs.size, metricRows };
}

async function materializeProposalScores(limit: number) {
  const classifications = await fetchAll<{ proposal_id: string }>(
    "proposal_classifications",
    "proposal_id",
    "proposal_id",
  );
  const toProcess = classifications.slice(0, limit);
  const proposalIds = toProcess.map((row) => row.proposal_id);

  console.log(`\nMaterialização: ${classifications.length} classificações de proposições disponíveis; processando ${toProcess.length}`);
  console.log("Materialização: recalculando métricas de proposições dos parlamentares vinculados...");
  const metricRows = await updateProposalMetrics(proposalIds);
  console.log(`Materialização: ${metricRows} linhas de métricas de proposições recalculadas.`);
  return { classified: 0, failed: 0, skipped: 0, metricRows };
}

async function classifyProposals(params: {
  level: AnalysisLevel;
  runId: string;
  runMode: ClassificationRunMode;
  provider: ModelSelection["provider"];
  model: string;
  concurrency: number;
  postProcessMode: PostProcessMode;
}) {
  const metadata = publicValueClassificationMetadata();
  const statuses: ClassificationRunItemStatus[] = params.runMode === "retry_failed"
    ? ["failed"]
    : ["pending", "processing", "failed"];
  const runItems = await fetchRunItems(params.runId, "proposals", statuses);
  const proposals = await fetchByIds<ProposalRow>(
    "proposals",
    runItems.map((item) => item.item_id),
    "id, type, number, year, proposal_date, summary, status, url",
  );
  const proposalMap = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const toProcess = runItems.map((item) => ({ item, proposal: proposalMap.get(item.item_id) }));
  const updatedProposalIds: string[] = [];
  const recentDurations: number[] = [];
  const runStartedAt = Date.now();
  let failed = 0;
  let pausedError: unknown = null;

  console.log(`\nProposições no run: ${runItems.length}; processando ${toProcess.length}`);
  await runWithConcurrency(toProcess, params.concurrency, async (task, index) => {
    if (pausedError) return;
    const { item, proposal } = task;
    const start = performance.now();
    const label = proposal
      ? `${proposal.type ?? "Proposição"} ${proposal.number ?? proposal.id}/${proposal.year ?? ""}`.replace(/\/$/, "")
      : item.item_label ?? item.item_id;
    progressLine({
      index,
      total: toProcess.length,
      runStartedAt,
      recentDurations,
      label,
    });
    await markRunItemProcessing(item);
    if (!proposal) {
      const elapsedMs = recordDuration(recentDurations, start);
      await markRunItemDone(item, "skipped", { durationMs: elapsedMs, error: new Error("Proposição não encontrada no banco") });
      console.log(terminal.warning("  ⚠ Proposição não encontrada; item pulado."));
      return;
    }
    if (proposal.summary) {
      console.log(`  Resumo: ${shortText(proposal.summary, 180)}`);
    }
    try {
      let fullText: FullTextResult | undefined;
      if (params.level === 3) {
        const result = await getFullTextForProposal(Number(proposal.id));
        if (result) {
          fullText = result;
          console.log(`  Inteiro teor: ${result.wordCount} palavras, ~${result.tokenEstimate} tokens (${result.fromCache ? "cache" : "baixado"})`);
        } else {
          console.log(terminal.warning("  ⚠ Sem inteiro teor; análise N3 será limitada e conservadora"));
        }
      }
      const parsed = await generateJsonResult({
        provider: params.provider,
        model: params.model,
        prompt: proposalPrompt(proposal, params.level, fullText),
        parse: parseProposalResult,
        label,
      });
      const fallbackType = inferLegislativeType(`${proposal.type ?? ""} ${proposal.summary ?? ""}`);
      await upsertBatches("proposal_classifications", [{
        proposal_id: proposal.id,
        category: parsed.category,
        confidence: parsed.confidence,
        justification: parsed.justification,
        source: "llm",
        analysis_level: params.level,
        methodology_version: metadata.methodologyVersion,
        ...proposalAnalysisColumns(parsed, fallbackType),
        updated_at: new Date().toISOString(),
      }], "proposal_id");
      updatedProposalIds.push(proposal.id);
      const elapsedMs = recordDuration(recentDurations, start);
      await markRunItemDone(item, "classified", { durationMs: elapsedMs });
      console.log(terminal.success(`  ✓ Classificação: ${PUBLIC_VALUE_CATEGORIES[parsed.category].label} (${parsed.confidence})`));
      console.log(`  Justificativa: ${shortText(parsed.justification)}`);
      console.log(`  Tempo do item: ${formatEta(elapsedMs)}`);
    } catch (error) {
      const elapsedMs = recordDuration(recentDurations, start);
      failed += 1;
      await markRunItemDone(item, "failed", { durationMs: elapsedMs, error });
      console.log(terminal.error(`  ✗ Falha: ${errorMessage(error).substring(0, 120)}`));
      console.log(`  Tempo do item: ${formatEta(elapsedMs)}`);
      if (isHardQuotaError(error)) pausedError = error;
    }
    const counts = await refreshRunCounts(params.runId);
    console.log(`  Run: ${terminal.success(`${counts.classified_count} classificados`)} | ${terminal.error(`${counts.failed_count} falhas`)} | ${terminal.warning(`${counts.pending_count} pendentes`)}`);
    if (params.concurrency === 1 && index < toProcess.length - 1) await sleep(DEFAULT_DELAY_MS);
  });

  if (pausedError) {
    await updateRunStatus(params.runId, "paused", errorMessage(pausedError));
    console.log(terminal.warning(`\nExecução pausada por quota/limite: ${shortText(errorMessage(pausedError), 180)}`));
    return { classified: updatedProposalIds.length, failed, skipped: 0, metricRows: 0 };
  }

  if (params.postProcessMode === "classify_only") {
    console.log(`\nProposições: ${updatedProposalIds.length} classificadas; métricas não foram recalculadas nesta execução.`);
    return { classified: updatedProposalIds.length, failed, skipped: 0, metricRows: 0 };
  }

  console.log(`\nProposições: ${updatedProposalIds.length} classificadas; recalculando métricas dos parlamentares afetados...`);
  const metricRows = await updateProposalMetrics(updatedProposalIds);
  console.log(`Proposições: ${metricRows} linhas de métricas recalculadas.`);
  return { classified: updatedProposalIds.length, failed, skipped: 0, metricRows };
}

async function classifyVotes(params: {
  level: AnalysisLevel;
  runId: string;
  runMode: ClassificationRunMode;
  provider: ModelSelection["provider"];
  model: string;
  strongReview?: StrongReviewConfig;
  concurrency: number;
  postProcessMode: PostProcessMode;
}) {
  const statuses: ClassificationRunItemStatus[] = params.runMode === "retry_failed"
    ? ["failed"]
    : ["pending", "processing", "failed"];
  const runItems = await fetchRunItems(params.runId, "votes", statuses);
  const votes = await fetchByIds<VoteRow>(
    "votes",
    runItems.map((item) => item.item_id),
    "id, vote_date, description, summary, url, session_number",
  );
  const voteMap = new Map(votes.map((vote) => [vote.id, vote]));
  const toProcess = runItems.map((item) => ({ item, vote: voteMap.get(item.item_id) }));
  const analyses = new Map<string, PublicVoteAnalysis>();
  const recentDurations: number[] = [];
  const runStartedAt = Date.now();
  let failed = 0;
  let pausedError: unknown = null;

  console.log(`\nVotações no run: ${runItems.length}; processando ${toProcess.length}`);
  await runWithConcurrency(toProcess, params.concurrency, async (task, index) => {
    if (pausedError) return;
    const { item, vote } = task;
    const start = performance.now();
    progressLine({
      index,
      total: toProcess.length,
      runStartedAt,
      recentDurations,
      label: vote?.id ?? item.item_id,
    });
    await markRunItemProcessing(item);
    if (!vote) {
      const elapsedMs = recordDuration(recentDurations, start);
      await markRunItemDone(item, "skipped", { durationMs: elapsedMs, error: new Error("Votação não encontrada no banco") });
      console.log(terminal.warning("  ⚠ Votação não encontrada; item pulado."));
      return;
    }
    if (vote.description) {
      console.log(`  Descrição: ${shortText(vote.description, 180)}`);
    }
    try {
      let fullText: FullTextResult | undefined;
      if (params.level === 3) {
        const result = await getFullTextForVote(vote.id);
        if (result) {
          fullText = result;
          console.log(`  Inteiro teor: proposição #${result.proposicaoId}, ${result.wordCount} palavras, ~${result.tokenEstimate} tokens (${result.fromCache ? "cache" : "baixado"})`);
        } else {
          console.log(terminal.warning("  ⚠ Sem inteiro teor; análise N3 será limitada e conservadora"));
        }
      }
      let parsed = await generateJsonResult({
        provider: params.provider,
        model: params.model,
        prompt: votePrompt(vote, params.level, fullText),
        parse: parseVoteResult,
        label: vote.id,
      });
      if (params.level === 3) {
        parsed = finalizeVoteResult(parsed, vote, params.model, fullText, { modelRole: "triage" });
        if (parsed.needsStrongReview && params.strongReview?.enabled && params.strongReview.provider && params.strongReview.model) {
          console.log(`  Revisão forte: ${params.strongReview.provider.name} / ${params.strongReview.model}`);
          const strongParsed = await generateJsonResult<VoteLlmResult>({
            provider: params.strongReview.provider,
            model: params.strongReview.model,
            prompt: strongVotePrompt(vote, fullText, parsed),
            parse: parseVoteResult,
            label: "votação N3 revisão forte",
          });
          parsed = finalizeVoteResult(strongParsed, vote, params.strongReview.model, fullText, {
            modelRole: "strong_review",
            previousAnalysis: parsed,
          });
        }
      }
      const fallbackType = inferLegislativeType(`${vote.description ?? ""} ${vote.summary ?? ""}`);
      const fallbackObjectType = inferVoteObjectType(vote.description);
      const analysis: PublicVoteAnalysis = {
        voteId: vote.id,
        classification: parsed.classification,
        severity: parsed.severity,
        publicInterestVote: parsed.publicInterestVote,
        confidence: parsed.confidence,
        isProceduralVote: parsed.isProceduralVote,
        legislativeType: parsed.legislativeType ?? fallbackType,
        decisionNature: parsed.decisionNature,
        decisionScope: parsed.decisionScope,
        voteObjectType: parsed.voteObjectType ?? fallbackObjectType,
        voteObjectSubtype: parsed.voteObjectSubtype,
        voteObjectDescription: parsed.voteObjectDescription,
        yesMeans: parsed.yesMeans,
        noMeans: parsed.noMeans,
        voteObjectTextFound: parsed.voteObjectTextFound,
        primaryTextUsed: parsed.primaryTextUsed,
        usedRelatedBillAsMainEvidence: parsed.usedRelatedBillAsMainEvidence,
        analyzedTextMatchesVoteObject: parsed.analyzedTextMatchesVoteObject,
        scoreImpactLimit: parsed.scoreImpactLimit,
        recommendedScoreImpact: parsed.recommendedScoreImpact,
        scoreSafetyReason: parsed.scoreSafetyReason,
        modelRecommendation: parsed.modelRecommendation,
        modelUsed: parsed.modelUsed,
        modelRole: parsed.modelRole,
        riskLevel: parsed.riskLevel,
        analysisStatus: parsed.analysisStatus,
        affectsScore: parsed.affectsScore,
        scorePoints: parsed.scorePoints,
        needsStrongReview: parsed.needsStrongReview,
        reviewReason: parsed.reviewReason,
        coverageCategory: parsed.coverageCategory,
        declaredBenefit: parsed.declaredBenefit,
        hiddenCost: parsed.hiddenCost,
        netPublicEffect: parsed.netPublicEffect,
        hasTradeoff: parsed.hasTradeoff,
        summaryMatchesText: parsed.summaryMatchesText,
        riskFlags: parsed.riskFlags,
        criticalArticles: parsed.criticalArticles,
        reason: parsed.reason,
        source: "llm",
        analysisLevel: params.level,
        reviewedManually: false,
        methodologyVersion: VOTE_METHODOLOGY_VERSION,
        analysisMethodVersion: parsed.analysisMethodVersion,
        analysisPayload: parsed.analysisPayload,
      };
      const normalized = normalizeVoteAnalysis(analysis);
      await upsertBatches("vote_classifications", [{
        vote_id: vote.id,
        session_number: vote.session_number ?? sessionNumberFromVoteId(vote.id),
        classification: normalized.classification,
        severity: normalized.severity,
        public_interest_vote: dbPublicInterestVote(normalized.publicInterestVote),
        confidence: normalized.confidence,
        reason: normalized.reason,
        source: "llm",
        analysis_level: params.level,
        reviewed_manually: false,
        methodology_version: normalized.methodologyVersion,
        ...voteAnalysisColumns(parsed, fallbackType, fallbackObjectType),
        updated_at: new Date().toISOString(),
      }], "vote_id,session_number");
      analyses.set(vote.id, normalized);
      const elapsedMs = recordDuration(recentDurations, start);
      await markRunItemDone(item, "classified", { durationMs: elapsedMs });
      console.log(terminal.success(`  ✓ Classificação: ${parsed.classification} | Severidade: ${parsed.severity} | Voto público: ${parsed.publicInterestVote}`));
      console.log(`  Justificativa: ${shortText(parsed.reason)}`);
      console.log(`  Tempo do item: ${formatEta(elapsedMs)}`);
    } catch (error) {
      const elapsedMs = recordDuration(recentDurations, start);
      failed += 1;
      await markRunItemDone(item, "failed", { durationMs: elapsedMs, error });
      console.log(terminal.error(`  ✗ Falha: ${errorMessage(error).substring(0, 120)}`));
      console.log(`  Tempo do item: ${formatEta(elapsedMs)}`);
      if (isHardQuotaError(error)) pausedError = error;
    }
    const counts = await refreshRunCounts(params.runId);
    console.log(`  Run: ${terminal.success(`${counts.classified_count} classificados`)} | ${terminal.error(`${counts.failed_count} falhas`)} | ${terminal.warning(`${counts.pending_count} pendentes`)}`);
    if (params.concurrency === 1 && index < toProcess.length - 1) await sleep(DEFAULT_DELAY_MS);
  });

  if (pausedError) {
    await updateRunStatus(params.runId, "paused", errorMessage(pausedError));
    console.log(terminal.warning(`\nExecução pausada por quota/limite: ${shortText(errorMessage(pausedError), 180)}`));
    return {
      classified: analyses.size,
      failed,
      skipped: 0,
      linksUpdated: 0,
      metricRows: 0,
    };
  }

  if (params.postProcessMode === "classify_only") {
    console.log(`\nVotações: ${analyses.size} classificadas; scores/ranking não foram recalculados nesta execução.`);
    return {
      classified: analyses.size,
      failed,
      skipped: 0,
      linksUpdated: 0,
      metricRows: 0,
    };
  }

  console.log(`\nVotações: ${analyses.size} classificadas; atualizando votos dos parlamentares vinculados...`);
  const affectedPairs = await updateLegislatorVotes(analyses);
  console.log(`Votações: ${affectedPairs.size} pares parlamentar/período afetados; recalculando métricas...`);
  const metricRows = await updateVoteMetrics(affectedPairs);
  console.log(`Votações: ${metricRows} linhas de métricas recalculadas.`);
  return {
    classified: analyses.size,
    failed,
    skipped: 0,
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
  console.log("  3) Auditoria N3 segura · mini-first + pendência sem score");
  const answer = await question(rl, `Escolha [${fallback}]: `);
  return (answer || fallback) === "3" ? 3 : 2;
}

async function selectScope(rl: Wizard, counts?: EligibilityCounts, target?: ClassifyTarget) {
  if (counts && target) printEligibilityCounts(target, counts);
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

async function selectConcurrency(rl: Wizard) {
  const answer = await question(rl, `\nProcessos simultâneos [${DEFAULT_CONCURRENCY}]: `);
  const parsed = Number(answer || DEFAULT_CONCURRENCY);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_CONCURRENCY;
}

async function selectPostProcessMode(rl: Wizard, target: ClassifyTarget, limit: number): Promise<PostProcessMode> {
  const fallback = target === "proposals" ? "2" : limit > 100 ? "1" : "2";
  console.log("\nPós-processamento de scores:");
  console.log("  1) Só classificar — grava análises, sem recalcular ranking agora");
  console.log("  2) Classificar e recalcular afetados — atualiza score/ranking ao final");
  const materializeLabel = target === "votes"
    ? "votações"
    : target === "proposals"
      ? "proposições"
      : "votações e proposições";
  console.log(`  3) Só materializar ${materializeLabel} — não chama IA, recalcula scores com análises já gravadas`);
  const answer = await question(rl, `Escolha [${fallback}]: `);
  const value = answer || fallback;
  if (value === "3") return "materialize_only";
  if (value === "1") return "classify_only";
  return "classify_and_recalculate";
}

async function selectStrongReview(config: Awaited<ReturnType<typeof loadConfig>>): Promise<StrongReviewConfig> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("\nRevisão avançada do N3:");
  console.log("  1) Desativada — casos inseguros ficam pendentes/null");
  console.log("  2) Ativada — chamar outro modelo só quando a triagem leve pedir revisão");
  const answer = await question(rl, "Escolha [1]: ");
  rl.close();
  if (answer !== "2") return { enabled: false };
  const selection = await interactiveSelect(config, "revisão forte N3");
  return { enabled: true, provider: selection.provider, model: selection.model };
}

function postProcessModeLabel(mode: PostProcessMode, target?: ClassifyTarget) {
  if (mode === "classify_only") return "Só classificar, sem recalcular ranking agora";
  if (mode === "materialize_only") {
    if (target === "proposals") return "Só materializar proposições já classificadas";
    if (target === "both") return "Só materializar votações e proposições já classificadas";
    return "Só materializar votações já classificadas";
  }
  return "Classificar e recalcular afetados";
}

function isProviderId(value: string | null | undefined): value is ProviderId {
  return value === "gemini" || value === "openai" || value === "ollama" || value === "lmstudio";
}

async function ensureProviderCredentials(selections: Array<ModelSelection | undefined | null>) {
  const providers = new Map<ProviderId, string>();
  for (const selection of selections) {
    if (!selection) continue;
    providers.set(selection.provider.id, selection.provider.name);
  }
  if (providers.size === 0) return;

  const needsOpenAi = providers.has("openai") && !process.env.OPENAI_API_KEY;
  const needsGemini = providers.has("gemini") && !process.env.GEMINI_API_KEY;
  if (!needsOpenAi && !needsGemini) return;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  if (needsOpenAi) {
    const key = (await rl.question("OPENAI_API_KEY (usada só nesta sessão): ")).trim();
    if (key) process.env.OPENAI_API_KEY = key;
  }
  if (needsGemini) {
    const key = (await rl.question("GEMINI_API_KEY (usada só nesta sessão): ")).trim();
    if (key) process.env.GEMINI_API_KEY = key;
  }
  rl.close();
}

async function selectRunMode(rl: Wizard, latestRun: ClassificationRunRow | null): Promise<ClassificationRunMode> {
  console.log("\nExecução do lote:");
  console.log(`  Última incompleta: ${runSummary(latestRun)}`);
  console.log("  1) Nova execução");
  console.log("  2) Continuar última execução incompleta");
  console.log("  3) Reprocessar somente falhas da última execução");
  const fallback = latestRun ? "2" : "1";
  const answer = await question(rl, `Escolha [${fallback}]: `);
  const value = answer || fallback;
  if (value === "2" && latestRun) return "resume";
  if (value === "3" && latestRun) return "retry_failed";
  return "new";
}

async function confirmRun(rl: Wizard, params: {
  target: ClassifyTarget;
  level: AnalysisLevel;
  scope: ClassifyScope;
  limit: number;
  concurrency: number;
  postProcessMode: PostProcessMode;
  runMode: ClassificationRunMode;
  runId?: string;
  providerName?: string;
  model?: string;
  strongReview?: StrongReviewConfig;
}) {
  console.log("\nResumo da execução:");
  console.log(`  Execução: ${params.runMode === "new" ? "Nova" : params.runMode === "resume" ? "Continuar última" : "Reprocessar falhas"}${params.runId ? ` (${params.runId.slice(0, 8)})` : ""}`);
  const targetLabel = params.postProcessMode === "materialize_only"
    ? "Votações (materialização)"
    : params.target === "votes" ? "Votações" : params.target === "proposals" ? "Proposições" : "Ambos";
  console.log(`  Alvo: ${targetLabel}`);
  console.log(`  Nível: ${params.level}`);
  console.log(`  Escopo: ${params.scope === "overwrite" ? "Sobrescrever mesmo nível/inferior" : "Pendentes/melhoráveis"}`);
  console.log(`  Limite por alvo: ${params.limit}`);
  console.log(`  Processos simultâneos: ${params.concurrency}`);
  console.log(`  Pós-processamento: ${postProcessModeLabel(params.postProcessMode, params.target)}`);
  if (params.providerName && params.model) {
    console.log(`  Provedor/modelo leve: ${params.providerName} / ${params.model}`);
    if (params.level === 3) {
      if (params.strongReview?.enabled && params.strongReview.provider && params.strongReview.model) {
        console.log(`  Provedor/modelo pesado: ${params.strongReview.provider.name} / ${params.strongReview.model}`);
      } else {
        console.log("  Modelo pesado: desativado; casos inseguros ficam pendentes para revisão");
      }
    }
  } else {
    console.log("  Provedor/modelo: não usado");
  }
  if (params.providerName === "OpenAI" && params.concurrency > 3) {
    console.log(terminal.warning("  ⚠ OpenAI com mais de 3 processos simultâneos aumenta bastante o risco de 429. Recomendado: 2 ou 3."));
  }
  const answer = await question(rl, "Executar e gravar no banco? [s/N]: ");
  return answer.toLocaleLowerCase("pt-BR") === "s";
}

async function main() {
  const config = await loadConfig();
  await assertClassificationRunSchema();
  const firstRl = createInterface({ input: process.stdin, output: process.stdout });
  const latestRun = await latestClassificationRun();
  const runMode = await selectRunMode(firstRl, latestRun);

  let run: ClassificationRunRow | null = runMode === "new" ? null : latestRun;
  let target: ClassifyTarget;
  let level: AnalysisLevel;
  let scope: ClassifyScope;
  let limit: number;
  let concurrency: number;
  let postProcessMode: PostProcessMode;

  if (run) {
    target = run.target;
    level = run.analysis_level;
    scope = run.scope;
    limit = run.limit_per_target;
    concurrency = run.concurrency;
    postProcessMode = run.post_process_mode;
  } else {
    target = await selectTarget(firstRl, config.lastTarget);
    level = await selectLevel(firstRl, config.lastMode);
    if (level === 3) await assertLegislativeImpactSchema();
    const counts = await getEligibilityCounts(level);
    scope = await selectScope(firstRl, counts, target);
    limit = await selectLimit(firstRl);
    concurrency = await selectConcurrency(firstRl);
    postProcessMode = await selectPostProcessMode(firstRl, target, limit);
  }
  firstRl.close();

  if (level === 3) await assertLegislativeImpactSchema();

  let selection: ModelSelection | null = null;
  let strongReview: StrongReviewConfig = { enabled: false };

  if (postProcessMode !== "materialize_only") {
    if (run) {
      if (!isProviderId(run.provider) || !run.model) {
        throw new Error(`Run ${run.id} não tem provider/modelo válidos para retomada.`);
      }
      selection = {
        provider: getProvider(run.provider, config.providers[run.provider]),
        model: run.model,
      };
      if (level === 3 && run.strong_review_enabled) {
        if (!isProviderId(run.strong_provider) || !run.strong_model) {
          throw new Error(`Run ${run.id} tem revisão forte ligada, mas não tem provider/modelo forte válidos.`);
        }
        strongReview = {
          enabled: true,
          provider: getProvider(run.strong_provider, config.providers[run.strong_provider]),
          model: run.strong_model,
        };
      }
    } else {
      selection = await interactiveSelect(config, level === 3 ? "triagem leve N3" : "classificar");
      if (level === 3) strongReview = await selectStrongReview(config);
    }
  }

  await ensureProviderCredentials([selection, strongReview.enabled ? { provider: strongReview.provider!, model: strongReview.model! } : null]);

  const confirmRl = createInterface({ input: process.stdin, output: process.stdout });
  const canRun = await confirmRun(confirmRl, {
    target,
    level,
    scope,
    limit,
    concurrency,
    postProcessMode,
    runMode,
    runId: run?.id,
    providerName: selection?.provider.name,
    model: selection?.model,
    strongReview,
  });
  confirmRl.close();
  if (!canRun) {
    console.log("Execução cancelada.");
    return;
  }

  if (!run) {
    run = await createClassificationRun({
      target,
      level,
      scope,
      limit,
      concurrency,
      postProcessMode,
      provider: selection?.provider.id,
      model: selection?.model,
      strongReview: {
        enabled: strongReview.enabled,
        provider: strongReview.provider?.id,
        model: strongReview.model,
      },
    });
    if (postProcessMode !== "materialize_only") {
      const prepared = await prepareRunItemsForNewRun({ runId: run.id, target, level, scope, limit });
      console.log(`Run ${run.id.slice(0, 8)} preparado com ${prepared} itens.`);
    }
  }

  if (selection && runMode === "new") {
    config.lastProvider = selection.provider.id;
    config.lastModel = selection.model;
    config.lastMode = level === 3 ? "advanced" : "basic";
    config.lastTarget = target === "both" ? "votes" : target;
    await saveConfig(config);
  }

  await updateRunStatus(run.id, "running");
  const started = Date.now();
  const stats: RunStats = {
    proposals: { classified: 0, failed: 0, skipped: 0, metricRows: 0 },
    votes: { classified: 0, failed: 0, skipped: 0, metricRows: 0, linksUpdated: 0 },
  };
  if (postProcessMode === "materialize_only") {
    if (target === "votes" || target === "both") {
      stats.votes = await materializeVoteScores(limit);
    }
    if (target === "proposals" || target === "both") {
      stats.proposals = await materializeProposalScores(limit);
    }
  } else if (selection) {
    const runParams = {
      level,
      concurrency,
      provider: selection.provider,
      model: selection.model,
      strongReview,
      postProcessMode,
      runId: run.id,
      runMode,
    };

    if (target === "votes" || target === "both") {
      stats.votes = await classifyVotes(runParams);
    }
    const runAfterVotes = await readClassificationRun(run.id);
    if (runAfterVotes.status !== "paused" && (target === "proposals" || target === "both")) {
      stats.proposals = await classifyProposals(runParams);
    }
  }
  const finalRun = await finishRunIfNotPaused(run.id);

  const elapsedMs = Date.now() - started;
  console.log("\n====================================");
  console.log(terminal.success(postProcessMode === "materialize_only"
    ? "Materialização de scores concluída no banco"
    : "Classificação LLM gravada diretamente no banco"));
  console.log(`${postProcessMode === "materialize_only" ? "Nível selecionado" : "Nível gravado"}: ${level}`);
  console.log(`${terminal.muted("Tempo total")}: ${formatEta(elapsedMs)} (${formatCompletionDate(0)})`);
  console.log(`Run: ${terminal.info(finalRun.id.slice(0, 8))} · status ${colorStatus(finalRun.status)} · ${terminal.success(`${finalRun.classified_count}/${finalRun.total_items} classificados`)} · ${terminal.error(`${finalRun.failed_count} falhas`)} · ${terminal.warning(`${finalRun.pending_count} pendentes`)}`);
  console.log(`Votações: ${terminal.success(`${stats.votes.classified} classificadas`)}, ${terminal.error(`${stats.votes.failed} falhas`)}, ${terminal.warning(`${stats.votes.skipped} puladas`)}, ${terminal.info(`${stats.votes.metricRows} métricas recalculadas`)}`);
  console.log(`Proposições: ${terminal.success(`${stats.proposals.classified} classificadas`)}, ${terminal.error(`${stats.proposals.failed} falhas`)}, ${terminal.warning(`${stats.proposals.skipped} puladas`)}, ${terminal.info(`${stats.proposals.metricRows} métricas recalculadas`)}`);
}

main().catch((error: unknown) => {
  console.error(terminal.error("Erro fatal durante a classificação:"), error);
  process.exit(1);
});
