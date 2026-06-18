import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const BATCH_SIZE = 500;

type SnapshotData = {
  deputies: Array<{
    id: number;
    slug: string;
    name: string;
    civilName: string;
    photoUrl: string;
    chamberUrl: string;
    electionNumber: string | null;
    tseSequence: string | null;
    electionStatus: string | null;
    assetsTotal: number | null;
    assetsCount: number | null;
  }>;
  periods: Array<{
    id: string;
    label: string;
    start: string;
    end: string;
    partial: boolean;
    deputies: Array<{
      id: number;
      party: string;
      state: string;
      officeStart: string;
      officeEnd: string;
      daysInOffice: number;
      metrics: Record<string, unknown>;
    }>;
  }>;
  generatedAt: string;
  timezone: string;
  defaultPeriod: string;
  sources: Array<{ name: string; url: string; updatedAt: string }>;
};

type ProfileProposal = {
  id: string;
  type: string;
  number: string;
  year: string;
  date: string;
  summary: string;
  status: string;
  url: string;
  participationRole: string;
  participationLabel: string;
  proposalNature: string;
  proposalNatureLabel: string;
};

type ProfileVote = {
  voteId: string;
  candidateVote: string;
  classification: string;
  severity: string;
  scoreDelta: number;
  confidence: number | null;
  reason: string;
  source: string;
  reviewedManually: boolean;
  date: string;
  description: string;
  summary: string;
  url: string;
};

type ProfileData = {
  deputies: Array<{
    id: number;
    birthDate: string | null;
    birthPlace: string | null;
    education: string | null;
    office: string | null;
    staff: Array<{ name: string; role: string; startDate: string | null }>;
    assets: Array<{ type: string; description: string; value: number }>;
  }>;
  periods: Array<{
    id: string;
    deputies: Array<{
      id: number;
      expenseCategories: Array<{ name: string; total: number; documents: number }>;
      suppliers: Array<{ name: string; taxId: string | null; total: number; documents: number }>;
      largestExpenses: Array<{ category: string; supplier: string; date: string; value: number; documentUrl: string | null }>;
      proposals: ProfileProposal[];
      publicVotes?: ProfileVote[];
      amendments: Array<{ number: string; year: string; type: string; beneficiary: string; proposedValue: number; transferredValue: number }>;
    }>;
  }>;
};

type ProposalClassificationsFile = {
  methodologyVersion?: string;
  reviewedAt?: string;
  classifications?: Record<string, {
    category: string;
    confidence: string;
    justification?: string;
    source?: string;
    analysisLevel?: number;
  }>;
};

type VoteClassificationsFile = {
  methodologyVersion?: string;
  reviewedAt?: string;
  classifications?: Record<string, {
    classification: string;
    severity: string;
    publicInterestVote: string;
    confidence: number;
    reason?: string;
    source?: string;
    analysisLevel?: number;
    reviewedManually?: boolean;
  }>;
};

type TableRow = Record<string, string | number | boolean | null>;

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

async function upsertBatches(
  table: string,
  rows: TableRow[],
  options?: { onConflict?: string; ignoreDuplicates?: boolean },
) {
  if (rows.length === 0) return;
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const { error } = await withRetry(
      () => supabase.from(table).upsert(batch, options),
      `${table} upsert at row ${index}`,
    );
    if (error) throw new Error(`${table} upsert failed at row ${index}: ${error.message}`);
  }
}

async function insertBatches(table: string, rows: TableRow[]) {
  if (rows.length === 0) return;
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const { error } = await withRetry(
      () => supabase.from(table).insert(batch),
      `${table} insert at row ${index}`,
    );
    if (error) throw new Error(`${table} insert failed at row ${index}: ${error.message}`);
  }
}

async function fetchAllRows(
  table: string,
  select: string,
  orderColumn = "id",
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += BATCH_SIZE) {
    const to = from + BATCH_SIZE - 1;
    const { data, error } = await withRetry(
      () => supabase.from(table).select(select).order(orderColumn).range(from, to),
      `${table} select at row ${from}`,
    );
    if (error) throw new Error(`${table} select failed at row ${from}: ${error.message}`);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < BATCH_SIZE) break;
  }
  return rows;
}

async function deleteByLegislatorIds(table: string, legislatorIds: number[]) {
  if (legislatorIds.length === 0) return;
  for (let index = 0; index < legislatorIds.length; index += BATCH_SIZE) {
    const batch = legislatorIds.slice(index, index + BATCH_SIZE);
    const { error } = await withRetry(
      () => supabase.from(table).delete().in("legislator_id", batch),
      `${table} delete by legislator at row ${index}`,
    );
    if (error) throw new Error(`${table} delete by legislator failed: ${error.message}`);
  }
}

async function deleteByPeriodIds(table: string, periodIds: string[]) {
  if (periodIds.length === 0) return;
  const { error } = await withRetry(
    () => supabase.from(table).delete().in("period_id", periodIds),
    `${table} delete by period`,
  );
  if (error) throw new Error(`${table} delete by period failed: ${error.message}`);
}

async function replaceSources(sources: SnapshotData["sources"]) {
  const { error } = await withRetry(
    () => supabase.from("sources").delete().not("id", "is", null),
    "sources delete",
  );
  if (error) throw new Error(`sources delete failed: ${error.message}`);

  await insertBatches(
    "sources",
    sources.map((source) => ({
      name: source.name,
      url: source.url,
      updated_at: source.updatedAt || null,
    })),
  );
}

async function syncCore(snapshot: SnapshotData, profileDetails: ProfileData) {
  console.log("Upserting periods...");
  await upsertBatches(
    "periods",
    snapshot.periods.map((period) => ({
      id: period.id,
      label: period.label,
      start_date: period.start,
      end_date: period.end,
      is_partial: period.partial,
    })),
    { onConflict: "id" },
  );

  console.log(`Upserting ${snapshot.deputies.length} legislators...`);
  await upsertBatches(
    "legislators",
    snapshot.deputies.map((deputy) => ({
      id: deputy.id,
      slug: deputy.slug,
      name: deputy.name,
      civil_name: deputy.civilName,
      photo_url: deputy.photoUrl,
      chamber_url: deputy.chamberUrl,
      election_number: deputy.electionNumber,
      tse_sequence: deputy.tseSequence,
      election_status: deputy.electionStatus,
      assets_total: deputy.assetsTotal,
      assets_count: deputy.assetsCount,
    })),
    { onConflict: "id" },
  );

  console.log(`Upserting ${profileDetails.deputies.length} legislator details...`);
  await upsertBatches(
    "legislator_details",
    profileDetails.deputies.map((deputy) => ({
      legislator_id: deputy.id,
      birth_date: deputy.birthDate,
      birth_place: deputy.birthPlace,
      education: deputy.education,
      office: deputy.office,
    })),
    { onConflict: "legislator_id" },
  );
}

async function syncIdentityChildren(profileDetails: ProfileData) {
  const legislatorIds = profileDetails.deputies.map((deputy) => deputy.id);
  const assetRows: TableRow[] = [];
  const staffRows: TableRow[] = [];

  for (const deputy of profileDetails.deputies) {
    for (const asset of deputy.assets) {
      assetRows.push({
        legislator_id: deputy.id,
        type: asset.type,
        description: asset.description,
        value: asset.value,
      });
    }
    for (const staff of deputy.staff) {
      staffRows.push({
        legislator_id: deputy.id,
        name: staff.name,
        role: staff.role,
        start_date: staff.startDate,
      });
    }
  }

  console.log(`Replacing ${assetRows.length} assets and ${staffRows.length} staff records...`);
  await deleteByLegislatorIds("legislator_assets", legislatorIds);
  await deleteByLegislatorIds("legislator_staff", legislatorIds);
  await insertBatches("legislator_assets", assetRows);
  await insertBatches("legislator_staff", staffRows);
}

async function syncMetrics(snapshot: SnapshotData) {
  const metricRows: TableRow[] = [];
  const donorRows: TableRow[] = [];
  const campaignSupplierRows: TableRow[] = [];

  for (const period of snapshot.periods) {
    for (const deputy of period.deputies) {
      const metrics = deputy.metrics;
      metricRows.push({
        legislator_id: deputy.id,
        period_id: period.id,
        party: deputy.party,
        state: deputy.state,
        office_start: deputy.officeStart,
        office_end: deputy.officeEnd,
        days_in_office: deputy.daysInOffice,
        months_in_office: metricNumber(metrics.monthsInOffice),
        plenary_attendances: metricNumber(metrics.plenaryAttendances),
        plenary_sessions_total: metricNumber(metrics.plenarySessionsTotal),
        nominal_votes: metricNumber(metrics.nominalVotes),
        nominal_votes_total: metricNumber(metrics.nominalVotesTotal),
        substantive_proposals: metricNumber(metrics.substantiveProposals),
        oversight_proposals: metricNumber(metrics.oversightProposals),
        advanced_proposals: metricNumber(metrics.advancedProposals),
        converted_proposals: metricNumber(metrics.convertedProposals),
        author_proposals: metricNumber(metrics.authorProposals),
        coauthor_proposals: metricNumber(metrics.coauthorProposals),
        requester_proposals: metricNumber(metrics.requesterProposals),
        fiscalization_proposals: metricNumber(metrics.fiscalizationProposals),
        expenses_total: metricNumber(metrics.expensesTotal),
        expense_documents: metricNumber(metrics.expenseDocuments),
        supplier_concentration: metricNumber(metrics.supplierConcentration),
        campaign_candidacy_available: Boolean(metrics.campaignCandidacyAvailable),
        assets_available: Boolean(metrics.assetsAvailable),
        total_votes: metricNumber(metrics.totalVotes),
        total_campaign_receipts: metricNumber(metrics.totalCampaignReceipts),
        total_public_receipts: metricNumber(metrics.totalPublicReceipts),
        total_campaign_expenses: metricNumber(metrics.totalCampaignExpenses),
        public_contribution_points: metricNumber(metrics.publicContributionPoints),
        public_classified_proposals: metricNumber(metrics.publicClassifiedProposals) ?? 0,
        public_total_proposals: metricNumber(metrics.publicTotalProposals) ?? 0,
        public_vote_positive_points: metricNumber(metrics.publicVotePositivePoints) ?? 0,
        public_vote_negative_penalties: metricNumber(metrics.publicVoteNegativePenalties) ?? 0,
        public_vote_absence_penalties: metricNumber(metrics.publicVoteAbsencePenalties) ?? 0,
        public_votes_analyzed: metricNumber(metrics.publicVotesAnalyzed) ?? 0,
        public_vote_average_confidence: metricNumber(metrics.publicVoteAverageConfidence),
        public_vote_score: metricNumber(metrics.publicVoteScore),
      });

      for (const donor of metricArray<{ name: string; value: number }>(metrics.topDonors)) {
        donorRows.push({
          legislator_id: deputy.id,
          period_id: period.id,
          name: donor.name,
          value: donor.value,
        });
      }

      for (const supplier of metricArray<{ name: string; value: number }>(metrics.topSuppliers)) {
        campaignSupplierRows.push({
          legislator_id: deputy.id,
          period_id: period.id,
          name: supplier.name,
          value: supplier.value,
        });
      }
    }
  }

  const periodIds = snapshot.periods.map((period) => period.id);
  console.log(`Upserting ${metricRows.length} period metrics...`);
  await upsertBatches("legislator_period_metrics", metricRows, {
    onConflict: "legislator_id,period_id",
  });

  console.log(`Replacing ${donorRows.length} donors and ${campaignSupplierRows.length} campaign suppliers...`);
  await deleteByPeriodIds("legislator_period_top_donors", periodIds);
  await deleteByPeriodIds("legislator_period_top_campaign_suppliers", periodIds);
  await insertBatches("legislator_period_top_donors", donorRows);
  await insertBatches("legislator_period_top_campaign_suppliers", campaignSupplierRows);
}

async function syncProfileChildren(profileDetails: ProfileData) {
  const periodIds = profileDetails.periods.map((period) => period.id);
  const expenseRows: TableRow[] = [];
  const supplierRows: TableRow[] = [];
  const largestExpenseRows: TableRow[] = [];
  const amendmentRows: TableRow[] = [];

  for (const period of profileDetails.periods) {
    for (const deputy of period.deputies) {
      for (const category of deputy.expenseCategories) {
        expenseRows.push({
          legislator_id: deputy.id,
          period_id: period.id,
          name: category.name,
          total: category.total,
          documents: category.documents,
        });
      }

      for (const supplier of deputy.suppliers) {
        supplierRows.push({
          legislator_id: deputy.id,
          period_id: period.id,
          name: supplier.name,
          tax_id: supplier.taxId,
          total: supplier.total,
          documents: supplier.documents,
        });
      }

      for (const expense of deputy.largestExpenses) {
        largestExpenseRows.push({
          legislator_id: deputy.id,
          period_id: period.id,
          category: expense.category,
          supplier: expense.supplier,
          expense_date: emptyToNull(expense.date),
          value: expense.value,
          document_url: expense.documentUrl,
        });
      }

      for (const amendment of deputy.amendments) {
        amendmentRows.push({
          legislator_id: deputy.id,
          period_id: period.id,
          number: amendment.number,
          year: amendment.year,
          type: amendment.type,
          beneficiary: amendment.beneficiary,
          proposed_value: amendment.proposedValue,
          transferred_value: amendment.transferredValue,
        });
      }
    }
  }

  console.log("Replacing profile detail tables...");
  await deleteByPeriodIds("legislator_period_expense_categories", periodIds);
  await deleteByPeriodIds("legislator_period_suppliers", periodIds);
  await deleteByPeriodIds("legislator_period_largest_expenses", periodIds);
  await deleteByPeriodIds("legislator_amendments", periodIds);
  await insertBatches("legislator_period_expense_categories", expenseRows);
  await insertBatches("legislator_period_suppliers", supplierRows);
  await insertBatches("legislator_period_largest_expenses", largestExpenseRows);
  await insertBatches("legislator_amendments", amendmentRows);
}

async function syncProposals(profileDetails: ProfileData) {
  const periodIds = profileDetails.periods.map((period) => period.id);
  const proposals = new Map<string, TableRow>();
  const relationRows = new Map<string, TableRow>();

  for (const period of profileDetails.periods) {
    for (const deputy of period.deputies) {
      for (const proposal of deputy.proposals) {
        proposals.set(proposal.id, {
          id: proposal.id,
          type: proposal.type,
          number: proposal.number,
          year: proposal.year,
          proposal_date: emptyToNull(proposal.date),
          summary: proposal.summary,
          status: proposal.status,
          url: proposal.url,
          chamber_url: proposal.url,
        });

        const relationKey = [
          deputy.id,
          proposal.id,
          period.id,
          proposal.participationRole,
          proposal.proposalNature,
        ].join("|");
        relationRows.set(relationKey, {
          legislator_id: deputy.id,
          proposal_id: proposal.id,
          period_id: period.id,
          participation_role: proposal.participationRole,
          participation_label: proposal.participationLabel,
          proposal_nature: proposal.proposalNature,
          proposal_nature_label: proposal.proposalNatureLabel,
        });
      }
    }
  }

  console.log(`Upserting ${proposals.size} proposals and replacing ${relationRows.size} legislator proposal links...`);
  await upsertBatches("proposals", [...proposals.values()], { onConflict: "id" });
  await deleteByPeriodIds("legislator_proposals", periodIds);
  await insertBatches("legislator_proposals", [...relationRows.values()]);
}

async function syncVotes(profileDetails: ProfileData) {
  const periodIds = profileDetails.periods.map((period) => period.id);
  const votes = new Map<string, TableRow>();
  const voteRows = new Map<string, TableRow>();

  for (const period of profileDetails.periods) {
    for (const deputy of period.deputies) {
      for (const vote of deputy.publicVotes ?? []) {
        votes.set(vote.voteId, {
          id: vote.voteId,
          vote_date: emptyToNull(vote.date),
          description: vote.description,
          summary: vote.summary,
          url: vote.url,
          session_number: sessionNumberFromVoteId(vote.voteId),
        });

        const relationKey = [
          deputy.id,
          vote.voteId,
          period.id,
          vote.candidateVote,
        ].join("|");
        voteRows.set(relationKey, {
          legislator_id: deputy.id,
          vote_id: vote.voteId,
          period_id: period.id,
          candidate_vote: vote.candidateVote,
          score_delta: vote.scoreDelta,
          confidence: vote.confidence,
          reason: emptyToNull(vote.reason),
          source: emptyToNull(vote.source),
          reviewed_manually: vote.reviewedManually,
        });
      }
    }
  }

  console.log(`Upserting ${votes.size} votes and replacing ${voteRows.size} legislator vote links...`);
  await upsertBatches("votes", [...votes.values()], { onConflict: "id" });
  await deleteByPeriodIds("legislator_votes", periodIds);
  await insertBatches("legislator_votes", [...voteRows.values()]);
}

async function syncClassifications(
  proposalClassifications: ProposalClassificationsFile,
  voteClassifications: VoteClassificationsFile,
) {
  const [existingProposalRows, existingVoteRows] = await Promise.all([
    fetchAllRows("proposal_classifications", "proposal_id, analysis_level", "proposal_id"),
    fetchAllRows("vote_classifications", "vote_id, analysis_level"),
  ]);
  const existingProposalLevels = new Map(
    existingProposalRows.map((row: Record<string, unknown>) => [
      row.proposal_id as string,
      Number(row.analysis_level ?? 1),
    ]),
  );
  const existingVoteLevels = new Map(
    existingVoteRows.map((row: Record<string, unknown>) => [
      row.vote_id as string,
      Number(row.analysis_level ?? 1),
    ]),
  );

  const proposalRows = Object.entries(proposalClassifications.classifications ?? {}).map(
    ([proposalId, classification]) => {
      const source = classification.source ?? "reviewed";
      const analysisLevel = analysisLevelFor(source, classification.analysisLevel);
      return {
        proposal_id: proposalId,
        category: classification.category,
        confidence: classification.confidence,
        justification: classification.justification ?? null,
        source,
        analysis_level: analysisLevel,
        methodology_version: proposalClassifications.methodologyVersion ?? null,
      };
    },
  ).filter((row) => (existingProposalLevels.get(row.proposal_id) ?? 0) <= row.analysis_level);

  const voteRows = Object.entries(voteClassifications.classifications ?? {}).map(
    ([voteId, classification]) => {
      const source = classification.source ?? "reviewed";
      const analysisLevel = analysisLevelFor(source, classification.analysisLevel);
      return {
        vote_id: voteId,
        session_number: sessionNumberFromVoteId(voteId),
        classification: classification.classification,
        severity: classification.severity,
        public_interest_vote: classification.publicInterestVote,
        confidence: classification.confidence,
        reason: classification.reason ?? null,
        source,
        analysis_level: analysisLevel,
        reviewed_manually: classification.reviewedManually ?? true,
        methodology_version: voteClassifications.methodologyVersion ?? null,
      };
    },
  ).filter((row) => (existingVoteLevels.get(row.vote_id) ?? 0) <= row.analysis_level);

  console.log(`Upserting ${proposalRows.length} proposal classifications and ${voteRows.length} vote classifications...`);
  await upsertBatches(
    "votes",
    voteRows.map((row) => ({
      id: row.vote_id,
      vote_date: null,
      description: null,
      summary: null,
      url: null,
      session_number: row.session_number,
    })),
    { onConflict: "id", ignoreDuplicates: true },
  );
  await upsertBatches("proposal_classifications", proposalRows, { onConflict: "proposal_id" });
  await upsertBatches("vote_classifications", voteRows, { onConflict: "vote_id,session_number" });
}

async function updateMetadata(
  snapshot: SnapshotData,
  proposalClassifications: ProposalClassificationsFile,
) {
  console.log("Updating metadata and sources...");
  const { error } = await supabase.from("snapshot_metadata").upsert(
    {
      id: 1,
      generated_at: snapshot.generatedAt,
      timezone: snapshot.timezone,
      default_period: snapshot.defaultPeriod,
      last_updated_at: new Date().toISOString().split("T")[0],
      methodology_version: proposalClassifications.methodologyVersion ?? null,
      reviewed_at: proposalClassifications.reviewedAt ?? null,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`snapshot_metadata upsert failed: ${error.message}`);
  await replaceSources(snapshot.sources);
}

function metricNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metricArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function emptyToNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

function analysisLevelFor(source: string | undefined, explicitLevel?: number) {
  if (explicitLevel === 1 || explicitLevel === 2 || explicitLevel === 3) {
    return explicitLevel;
  }
  return source === "rule" ? 1 : 2;
}

function sessionNumberFromVoteId(voteId: string): string | null {
  const [, ...rest] = voteId.split("-");
  return rest.length > 0 ? rest.join("-") : null;
}

async function withRetry<T>(operation: () => PromiseLike<T>, label: string): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= 5) throw error;
      const delay = 750 * 2 ** attempt;
      console.warn(`${label} failed; retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}

async function refreshPostgrestSchema(client: SupabaseClient) {
  const { error } = await client.rpc("pgrst_reload_schema");
  if (error && error.code !== "PGRST202") {
    console.warn(`Could not request PostgREST schema reload: ${error.message}`);
  }
}

async function uploadToSupabase() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(scriptDir, "..", ".data");

  console.log("Reading JSON files...");
  const snapshot = await readJson<SnapshotData>(join(dataDir, "ranking-snapshot.json"));
  const profileDetails = await readJson<ProfileData>(join(dataDir, "profile-details.json"));
  const proposalClassifications = await readJson<ProposalClassificationsFile>(
    join(dataDir, "public-value-classifications.json"),
  );
  const voteClassifications = await readJson<VoteClassificationsFile>(
    join(dataDir, "public-vote-classifications.json"),
  );

  await refreshPostgrestSchema(supabase);
  await syncCore(snapshot, profileDetails);
  await syncIdentityChildren(profileDetails);
  await syncMetrics(snapshot);
  await syncProfileChildren(profileDetails);
  await syncProposals(profileDetails);
  await syncVotes(profileDetails);
  await syncClassifications(proposalClassifications, voteClassifications);
  await updateMetadata(snapshot, proposalClassifications);

  console.log("");
  console.log("====================================");
  console.log("Sync to Supabase complete!");
  console.log(`${snapshot.deputies.length} legislators, ${snapshot.periods.length} periods`);
}

uploadToSupabase().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
