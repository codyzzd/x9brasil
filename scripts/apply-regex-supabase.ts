import { loadEnvConfig } from "@next/env";
import {
  PUBLIC_VALUE_CATEGORIES,
  buildPublicVoteRecord,
  classifyProposal,
  classifyPublicVote,
  getProposalWeight,
  proposalStageMultiplier,
  type CandidateVote,
  type ParticipationRole,
  type ProposalNature,
  type ProposalStage,
  type PublicVoteAnalysis,
  type ProposalClassification,
} from "../src/lib/public-value";
import { createClient } from "../src/lib/database/client";

loadEnvConfig(process.cwd());

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable");
  process.exit(1);
}

const supabase = createClient();

const PAGE_SIZE = 1000;
const BATCH_SIZE = 500;

type Row = Record<string, unknown>;

type ProposalRow = {
  id: string;
  summary: string | null;
  status: string | null;
};

type VoteRow = {
  id: string;
  description: string | null;
  summary: string | null;
  session_number: string | null;
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

function chunks<T>(items: T[], size = BATCH_SIZE) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function upsertBatches(table: string, rows: Row[], onConflict: string) {
  for (const batch of chunks(rows)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`Failed to upsert ${table}: ${error.message}`);
  }
}

async function updateMetricRows(rows: Row[]) {
  if (rows.length === 0) return;

  const updateMap = new Map(rows.map((row) => [pairKey(Number(row.legislator_id), String(row.period_id)), row]));
  const periodIds = [...new Set(rows.map((row) => String(row.period_id)))];
  const existingRows = await fetchByIds<Row>(
    "legislator_period_metrics",
    periodIds,
    "*",
    "period_id",
  );
  const mergedRows: Row[] = [];

  for (const existing of existingRows) {
    const key = pairKey(Number(existing.legislator_id), String(existing.period_id));
    const update = updateMap.get(key);
    if (!update) continue;
    mergedRows.push({ ...existing, ...update });
  }

  await upsertBatches("legislator_period_metrics", mergedRows, "legislator_id,period_id");
}

async function fetchByIds<T extends Row>(table: string, ids: string[], select = "*", column = "id") {
  const rows: T[] = [];
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

function pairKey(legislatorId: number, periodId: string) {
  return `${legislatorId}|${periodId}`;
}

async function applyProposalRegex() {
  const [proposals, existing] = await Promise.all([
    fetchAll<ProposalRow>("proposals", "id, summary, status"),
    fetchAll<{ proposal_id: string; source: string; analysis_level: number | null }>(
      "proposal_classifications",
      "proposal_id, source, analysis_level",
      "proposal_id",
    ),
  ]);
  const existingClassification = new Map(existing.map((row) => [row.proposal_id, row]));
  const classifications = new Map<string, ProposalClassification>();
  const upsertedProposalIds = new Set<string>();
  const rows: Row[] = [];

  for (const proposal of proposals) {
    const classification = classifyProposal(proposal.id, proposal.summary ?? "");
    if (!classification) continue;
    const existingRow = existingClassification.get(proposal.id);
    const existingLevel = existingRow?.analysis_level ?? (existingRow?.source === "rule" ? 1 : 2);
    if (existingLevel > 1 || (existingRow?.source && existingRow.source !== "rule")) continue;
    classifications.set(proposal.id, classification);
    if (existingRow || upsertedProposalIds.has(proposal.id)) continue;
    upsertedProposalIds.add(proposal.id);
    rows.push({
      proposal_id: proposal.id,
      category: classification.category,
      confidence: classification.confidence,
      justification: classification.justification,
      source: "rule",
      analysis_level: 1,
      methodology_version: classification.methodologyVersion,
      updated_at: new Date().toISOString(),
    });
  }

  await upsertBatches("proposal_classifications", rows, "proposal_id");
  return classifications;
}

async function applyVoteRegex() {
  const [votes, existing] = await Promise.all([
    fetchAll<VoteRow>("votes", "id, description, summary, session_number"),
    fetchAll<{ vote_id: string; source: string; analysis_level: number | null }>(
      "vote_classifications",
      "vote_id, source, analysis_level",
    ),
  ]);
  const existingClassification = new Map(existing.map((row) => [row.vote_id, row]));
  const analyses = new Map<string, PublicVoteAnalysis>();
  const upsertedVoteIds = new Set<string>();
  const rows: Row[] = [];

  for (const vote of votes) {
    const analysis = classifyPublicVote(vote.id, vote.description ?? "", vote.summary ?? "");
    if (!analysis) continue;
    const existingRow = existingClassification.get(vote.id);
    const existingLevel = existingRow?.analysis_level ?? (existingRow?.source === "rule" ? 1 : 2);
    if (existingLevel > 1 || (existingRow?.source && existingRow.source !== "rule")) continue;
    analyses.set(vote.id, analysis);
    if (existingRow || upsertedVoteIds.has(vote.id)) continue;
    upsertedVoteIds.add(vote.id);
    rows.push({
      vote_id: vote.id,
      session_number: vote.session_number ?? sessionNumberFromVoteId(vote.id),
      classification: analysis.classification,
      severity: analysis.severity,
      public_interest_vote: analysis.publicInterestVote,
      confidence: analysis.confidence,
      reason: analysis.reason,
      source: "rule",
      analysis_level: 1,
      reviewed_manually: false,
      methodology_version: analysis.methodologyVersion,
      updated_at: new Date().toISOString(),
    });
  }

  await upsertBatches("vote_classifications", rows, "vote_id,session_number");
  return analyses;
}

async function updateLegislatorVotes(analyses: Map<string, PublicVoteAnalysis>) {
  if (analyses.size === 0) return new Set<string>();

  const voteIds = [...analyses.keys()];
  const links = await fetchByIds<LegislatorVoteRow>(
    "legislator_votes",
    voteIds,
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
      if (delta > 0) {
        positive += delta;
      } else if (delta < 0 && vote.candidate_vote === "absent") {
        absencePenalties += Math.abs(delta);
      } else if (delta < 0) {
        votePenalties += Math.abs(delta);
      }
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

async function updateProposalMetrics(newClassifications: Map<string, ProposalClassification>) {
  if (newClassifications.size === 0) return 0;

  const affectedLinks = await fetchByIds<LegislatorProposalRow>(
    "legislator_proposals",
    [...newClassifications.keys()],
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

  const proposalIds = [...new Set(allLinks.map((row) => row.proposal_id))];
  const [classRows, proposalRows] = await Promise.all([
    fetchByIds<{
      proposal_id: string;
      category: keyof typeof PUBLIC_VALUE_CATEGORIES;
      confidence: string;
      justification: string | null;
      source: string;
      analysis_level: number | null;
      methodology_version: string | null;
    }>("proposal_classifications", proposalIds, "proposal_id, category, confidence, justification, source, analysis_level, methodology_version", "proposal_id"),
    fetchByIds<ProposalRow>("proposals", proposalIds, "id, summary, status"),
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
      const stage = inferStage(proposalMap.get(link.proposal_id)?.status);
      const category = PUBLIC_VALUE_CATEGORIES[classification.category];
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

async function main() {
  console.log("Aplicando nível 1 regex diretamente no banco...\n");

  const proposalClassifications = await applyProposalRegex();
  console.log(`Proposições cobertas por regex: ${proposalClassifications.size}`);

  const voteAnalyses = await applyVoteRegex();
  console.log(`Votações cobertas por regex: ${voteAnalyses.size}`);

  const affectedVotePairs = await updateLegislatorVotes(voteAnalyses);
  const proposalMetricRows = await updateProposalMetrics(proposalClassifications);
  const voteMetricRows = await updateVoteMetrics(affectedVotePairs);

  console.log("");
  console.log("====================================");
  console.log("Regex nível 1 aplicado no banco");
  console.log(`Métricas de proposições recalculadas: ${proposalMetricRows}`);
  console.log(`Métricas de votos recalculadas: ${voteMetricRows}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
