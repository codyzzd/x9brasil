import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import type {
  DeputyIdentity,
  PeriodDeputyRecord,
  RankingPeriod,
  RankingSnapshot,
  ProfileIdentityDetails,
  ProfilePeriodDetails,
} from "@/lib/ranking";
import {
  calculatePublicValueRanking,
} from "@/lib/ranking";
import {
  classifyProposal,
  PUBLIC_VALUE_CATEGORIES,
  type ProposalStage,
  type ParticipationRole,
  type ProposalNature,
  type ProposalClassification,
  type PublicValueCategory,
  type ClassificationConfidence,
  type CriticalArticle,
  type RiskFlag,
} from "@/lib/public-value";

export type SnapshotMetadata = {
  generatedAt: string;
  timezone: string;
  defaultPeriod: string;
  sources: Array<{ name: string; url: string; updatedAt: string }>;
};

export type DataBannerStats = {
  updatedAt: string;
  totalItems: number;
  classifiedItems: number;
  coveragePercent: number;
  levels: {
    level1: { count: number; percent: number };
    level2: { count: number; percent: number };
    level3: { count: number; percent: number };
  };
};

const SUPABASE_PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>,
  context = "unknown query",
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await query(from, to);
    if (error) {
      console.error("Supabase paginated fetch failed", {
        context,
        from,
        to,
        error,
      });
      throw error;
    }

    rows.push(...(data ?? []));

    if (!data || data.length < SUPABASE_PAGE_SIZE) {
      return rows;
    }
  }
}

export async function getSnapshotMetadata(): Promise<SnapshotMetadata> {
  "use cache";
  cacheLife("hours");
  cacheTag("metadata");

  const { data: meta } = await supabase
    .from("snapshot_metadata")
    .select("*")
    .eq("id", 1)
    .single();

  const { data: sources } = await supabase
    .from("sources")
    .select("name, url, updated_at");

  return {
    generatedAt: meta?.generated_at ?? new Date().toISOString(),
    timezone: meta?.timezone ?? "America/Fortaleza",
    defaultPeriod: meta?.default_period ?? "legislature",
    sources: (sources ?? []).map((s: Record<string, unknown>) => ({
      name: s.name as string,
      url: s.url as string,
      updatedAt: (s.updated_at as string) ?? "",
    })),
  };
}

export async function getDataBannerStats(): Promise<DataBannerStats> {
  "use cache";
  cacheLife("hours");
  cacheTag("metadata");

  const [metadata, proposalCount, voteCount, proposalClassCount, voteClassCount, p1, p2, p3, v1, v2, v3] =
    await Promise.all([
      getSnapshotMetadata(),
      countRows("proposals"),
      countRows("votes"),
      countRows("proposal_classifications"),
      countRows("vote_classifications"),
      countRows("proposal_classifications", { column: "analysis_level", value: 1 }),
      countRows("proposal_classifications", { column: "analysis_level", value: 2 }),
      countRows("proposal_classifications", { column: "analysis_level", value: 3 }),
      countRows("vote_classifications", { column: "analysis_level", value: 1 }),
      countRows("vote_classifications", { column: "analysis_level", value: 2 }),
      countRows("vote_classifications", { column: "analysis_level", value: 3 }),
    ]);

  const totalItems = proposalCount + voteCount;
  const classifiedItems = proposalClassCount + voteClassCount;
  const sourceDates = metadata.sources
    .map((source) => source.updatedAt)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
  const updatedAt = sourceDates[0] ?? metadata.generatedAt;

  return {
    updatedAt,
    totalItems,
    classifiedItems,
    coveragePercent: percent(classifiedItems, totalItems),
    levels: {
      level1: { count: p1 + v1, percent: percent(p1 + v1, totalItems) },
      level2: { count: p2 + v2, percent: percent(p2 + v2, totalItems) },
      level3: { count: p3 + v3, percent: percent(p3 + v3, totalItems) },
    },
  };
}

async function countRows(
  table:
    | "proposals"
    | "votes"
    | "proposal_classifications"
    | "vote_classifications",
  filter?: { column: "analysis_level"; value: 1 | 2 | 3 },
) {
  const query = supabase.from(table).select("*", { count: "exact", head: true });
  const { count, error } = filter
    ? await query.eq(filter.column, filter.value)
    : await query;

  if (error) throw error;
  return count ?? 0;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export async function getFullSnapshot(): Promise<RankingSnapshot> {
  "use cache";
  cacheLife("hours");
  cacheTag("ranking");

  const [metadata, deputies, periods, metrics, donors, campaignSuppliers] = await Promise.all([
    getSnapshotMetadata(),
    getDeputies(),
    getPeriods(),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase.from("legislator_period_metrics").select("*").range(from, to),
      "legislator_period_metrics",
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("legislator_period_top_donors")
        .select("legislator_id, period_id, name, value")
        .range(from, to),
      "legislator_period_top_donors",
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("legislator_period_top_campaign_suppliers")
        .select("legislator_id, period_id, name, value")
        .range(from, to),
      "legislator_period_top_campaign_suppliers",
    ),
  ]);

  const donorsByPeriod = new Map<string, Array<{ name: string; value: number }>>();
  for (const d of donors) {
    const key = `${d.legislator_id}-${d.period_id}`;
    const arr = donorsByPeriod.get(key) ?? [];
    arr.push({ name: d.name as string, value: Number(d.value) });
    donorsByPeriod.set(key, arr);
  }

  const campaignSuppliersByPeriod = new Map<string, Array<{ name: string; value: number }>>();
  for (const d of campaignSuppliers) {
    const key = `${d.legislator_id}-${d.period_id}`;
    const arr = campaignSuppliersByPeriod.get(key) ?? [];
    arr.push({ name: d.name as string, value: Number(d.value) });
    campaignSuppliersByPeriod.set(key, arr);
  }

  const periodRecords: RankingPeriod[] = periods.map((period) => {
    const periodMetrics = metrics
      .filter((m: Record<string, unknown>) => m.period_id === period.id)
      .map((m: Record<string, unknown>) => {
        const key = `${m.legislator_id}-${m.period_id}`;
        return {
          id: m.legislator_id as number,
          party: m.party as string,
          state: m.state as string,
          officeStart: m.office_start as string,
          officeEnd: m.office_end as string,
          daysInOffice: m.days_in_office as number,
          metrics: {
            monthsInOffice: Number(m.months_in_office ?? 0),
            plenaryAttendances: m.plenary_attendances as number | null,
            plenarySessionsTotal: m.plenary_sessions_total as number | null,
            nominalVotes: m.nominal_votes as number | null,
            nominalVotesTotal: m.nominal_votes_total as number | null,
            substantiveProposals: m.substantive_proposals as number | null,
            oversightProposals: m.oversight_proposals as number | null,
            advancedProposals: m.advanced_proposals as number | null,
            convertedProposals: m.converted_proposals as number | null,
            authorProposals: m.author_proposals as number | null,
            coauthorProposals: m.coauthor_proposals as number | null,
            requesterProposals: m.requester_proposals as number | null,
            fiscalizationProposals: m.fiscalization_proposals as number | null,
            expensesTotal: m.expenses_total as number | null,
            expenseDocuments: m.expense_documents as number | null,
            supplierConcentration: m.supplier_concentration as number | null,
            campaignCandidacyAvailable: (m.campaign_candidacy_available as boolean) ?? false,
            assetsAvailable: (m.assets_available as boolean) ?? false,
            totalVotes: m.total_votes as number | null,
            totalCampaignReceipts: m.total_campaign_receipts as number | null,
            totalPublicReceipts: m.total_public_receipts as number | null,
            totalCampaignExpenses: m.total_campaign_expenses as number | null,
            topDonors: donorsByPeriod.get(key) ?? [],
            topSuppliers: campaignSuppliersByPeriod.get(key) ?? [],
            publicContributionPoints: m.public_contribution_points as number | null,
            publicClassifiedProposals: (m.public_classified_proposals as number) ?? 0,
            publicTotalProposals: (m.public_total_proposals as number) ?? 0,
            publicVotePositivePoints: (m.public_vote_positive_points as number) ?? 0,
            publicVoteNegativePenalties: (m.public_vote_negative_penalties as number) ?? 0,
            publicVoteAbsencePenalties: (m.public_vote_absence_penalties as number) ?? 0,
            publicVotesAnalyzed: (m.public_votes_analyzed as number) ?? 0,
            publicVoteAverageConfidence: m.public_vote_average_confidence as number | null,
            publicVoteScore: m.public_vote_score as number | null,
          },
        };
      });
    return {
      ...period,
      deputies: periodMetrics,
    };
  });

  return {
    version: 2,
    generatedAt: metadata.generatedAt,
    timezone: metadata.timezone as "America/Fortaleza",
    defaultPeriod: metadata.defaultPeriod,
    sources: metadata.sources,
    deputies,
    periods: periodRecords,
  };
}

export async function getDeputies(): Promise<DeputyIdentity[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("ranking");

  const data = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase
      .from("legislators")
      .select("id, slug, name, civil_name, photo_url, chamber_url, election_number, tse_sequence, election_status, assets_total, assets_count")
      .order("name")
      .range(from, to),
    "legislators",
  );

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    civilName: (row.civil_name as string) ?? "",
    photoUrl: (row.photo_url as string) ?? "",
    chamberUrl: (row.chamber_url as string) ?? "",
    electionNumber: row.election_number as string | null,
    tseSequence: row.tse_sequence as string | null,
    electionStatus: row.election_status as string | null,
    assetsTotal: row.assets_total as number | null,
    assetsCount: row.assets_count as number | null,
  }));
}

export async function getDeputy(slug: string): Promise<DeputyIdentity | undefined> {
  "use cache";
  cacheLife("hours");
  cacheTag("ranking");
  cacheTag(`deputy:${slug}`);

  const { data, error } = await supabase
    .from("legislators")
    .select("id, slug, name, civil_name, photo_url, chamber_url, election_number, tse_sequence, election_status, assets_total, assets_count")
    .eq("slug", slug)
    .single();

  if (error || !data) return undefined;

  const row = data as Record<string, unknown>;
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    civilName: (row.civil_name as string) ?? "",
    photoUrl: (row.photo_url as string) ?? "",
    chamberUrl: (row.chamber_url as string) ?? "",
    electionNumber: row.election_number as string | null,
    tseSequence: row.tse_sequence as string | null,
    electionStatus: row.election_status as string | null,
    assetsTotal: row.assets_total as number | null,
    assetsCount: row.assets_count as number | null,
  };
}

export async function getDeputyById(id: number): Promise<DeputyIdentity | undefined> {
  "use cache";
  cacheLife("hours");
  cacheTag("ranking");
  cacheTag(`deputy:${id}`);

  const { data, error } = await supabase
    .from("legislators")
    .select("id, slug, name, civil_name, photo_url, chamber_url, election_number, tse_sequence, election_status, assets_total, assets_count")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;

  const row = data as Record<string, unknown>;
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    civilName: (row.civil_name as string) ?? "",
    photoUrl: (row.photo_url as string) ?? "",
    chamberUrl: (row.chamber_url as string) ?? "",
    electionNumber: row.election_number as string | null,
    tseSequence: row.tse_sequence as string | null,
    electionStatus: row.election_status as string | null,
    assetsTotal: row.assets_total as number | null,
    assetsCount: row.assets_count as number | null,
  };
}

export async function getPeriods(): Promise<Array<{ id: string; label: string; start: string; end: string; partial: boolean }>> {
  "use cache";
  cacheLife("hours");
  cacheTag("metadata");

  const { data, error } = await supabase
    .from("periods")
    .select("*")
    .order("start_date");

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    label: row.label as string,
    start: row.start_date as string,
    end: row.end_date as string,
    partial: row.is_partial as boolean,
  }));
}

export async function getPeriodOptions() {
  const periods = await getPeriods();
  return periods.map(({ id, label, partial, end }) => ({
    id,
    label,
    partial,
    end,
  }));
}

export async function getPeriodMetrics(periodId: string): Promise<PeriodDeputyRecord[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("ranking");
  cacheTag(`period:${periodId}`);

  const [metrics, donors, suppliers] = await Promise.all([
    fetchAllRows<Record<string, unknown>>((from, to) => supabase
      .from("legislator_period_metrics")
      .select("*")
      .eq("period_id", periodId)
      .range(from, to),
      `legislator_period_metrics:${periodId}`,
    ),
    fetchAllRows<Record<string, unknown>>((from, to) => supabase
      .from("legislator_period_top_donors")
      .select("legislator_id, name, value")
      .eq("period_id", periodId)
      .range(from, to),
      `legislator_period_top_donors:${periodId}`,
    ),
    fetchAllRows<Record<string, unknown>>((from, to) => supabase
      .from("legislator_period_top_campaign_suppliers")
      .select("legislator_id, name, value")
      .eq("period_id", periodId)
      .range(from, to),
      `legislator_period_top_campaign_suppliers:${periodId}`,
    ),
  ]);

  const donorsByDeputy = new Map<number, Array<{ name: string; value: number }>>();
  for (const d of donors) {
    const legislatorId = d.legislator_id as number;
    const arr = donorsByDeputy.get(legislatorId) ?? [];
    arr.push({ name: d.name as string, value: Number(d.value) });
    donorsByDeputy.set(legislatorId, arr);
  }

  const campaignSuppliersByDeputy = new Map<number, Array<{ name: string; value: number }>>();
  for (const d of suppliers) {
    const legislatorId = d.legislator_id as number;
    const arr = campaignSuppliersByDeputy.get(legislatorId) ?? [];
    arr.push({ name: d.name as string, value: Number(d.value) });
    campaignSuppliersByDeputy.set(legislatorId, arr);
  }

  return metrics.map((row: Record<string, unknown>) => ({
    id: row.legislator_id as number,
    party: row.party as string,
    state: row.state as string,
    officeStart: row.office_start as string,
    officeEnd: row.office_end as string,
    daysInOffice: row.days_in_office as number,
    metrics: {
      monthsInOffice: Number(row.months_in_office ?? 0),
      plenaryAttendances: row.plenary_attendances as number | null,
      plenarySessionsTotal: row.plenary_sessions_total as number | null,
      nominalVotes: row.nominal_votes as number | null,
      nominalVotesTotal: row.nominal_votes_total as number | null,
      substantiveProposals: row.substantive_proposals as number | null,
      oversightProposals: row.oversight_proposals as number | null,
      advancedProposals: row.advanced_proposals as number | null,
      convertedProposals: row.converted_proposals as number | null,
      authorProposals: row.author_proposals as number | null,
      coauthorProposals: row.coauthor_proposals as number | null,
      requesterProposals: row.requester_proposals as number | null,
      fiscalizationProposals: row.fiscalization_proposals as number | null,
      expensesTotal: row.expenses_total as number | null,
      expenseDocuments: row.expense_documents as number | null,
      supplierConcentration: row.supplier_concentration as number | null,
      campaignCandidacyAvailable: (row.campaign_candidacy_available as boolean) ?? false,
      assetsAvailable: (row.assets_available as boolean) ?? false,
      totalVotes: row.total_votes as number | null,
      totalCampaignReceipts: row.total_campaign_receipts as number | null,
      totalPublicReceipts: row.total_public_receipts as number | null,
      totalCampaignExpenses: row.total_campaign_expenses as number | null,
      topDonors: donorsByDeputy.get(row.legislator_id as number) ?? [],
      topSuppliers: campaignSuppliersByDeputy.get(row.legislator_id as number) ?? [],
      publicContributionPoints: row.public_contribution_points as number | null,
      publicClassifiedProposals: (row.public_classified_proposals as number) ?? 0,
      publicTotalProposals: (row.public_total_proposals as number) ?? 0,
      publicVotePositivePoints: (row.public_vote_positive_points as number) ?? 0,
      publicVoteNegativePenalties: (row.public_vote_negative_penalties as number) ?? 0,
      publicVoteAbsencePenalties: (row.public_vote_absence_penalties as number) ?? 0,
      publicVotesAnalyzed: (row.public_votes_analyzed as number) ?? 0,
      publicVoteAverageConfidence: row.public_vote_average_confidence as number | null,
      publicVoteScore: row.public_vote_score as number | null,
    },
  }));
}

export async function getPeriodDeputies(periodId: string) {
  const [deputies, periodMetrics] = await Promise.all([
    getDeputies(),
    getPeriodMetrics(periodId),
  ]);

  const deputyMap = new Map(deputies.map((d) => [d.id, d]));

  return periodMetrics
    .filter((m) => deputyMap.has(m.id))
    .map((m) => {
      const identity = deputyMap.get(m.id)!;
      return { ...identity, ...m };
    });
}

export async function getRankedDeputies(periodId: string) {
  const deputies = await getPeriodDeputies(periodId);
  return calculatePublicValueRanking(deputies);
}

export async function getPeriodFacets(periodId: string) {
  const deputies = await getPeriodDeputies(periodId);
  return {
    states: Array.from(new Set(deputies.map((d) => d.state))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    ),
    parties: Array.from(new Set(deputies.map((d) => d.party))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    ),
  };
}

export async function resolvePeriod(periodId?: string) {
  const periods = await getPeriods();
  if (periodId) {
    const found = periods.find((p) => p.id === periodId);
    if (found) return found;
  }
  const meta = await getSnapshotMetadata();
  return periods.find((p) => p.id === meta.defaultPeriod) ?? periods[periods.length - 2] ?? periods[0];
}

export async function getTopDonors(legislatorId: number, periodId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("profile");
  cacheTag(`profile:${legislatorId}:${periodId}`);

  const { data } = await supabase
    .from("legislator_period_top_donors")
    .select("name, value")
    .eq("legislator_id", legislatorId)
    .eq("period_id", periodId)
    .order("value", { ascending: false });
  return (data ?? []).map((d: Record<string, unknown>) => ({ name: d.name as string, value: Number(d.value) }));
}

export async function getTopCampaignSuppliers(legislatorId: number, periodId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("profile");
  cacheTag(`profile:${legislatorId}:${periodId}`);

  const { data } = await supabase
    .from("legislator_period_top_campaign_suppliers")
    .select("name, value")
    .eq("legislator_id", legislatorId)
    .eq("period_id", periodId)
    .order("value", { ascending: false });
  return (data ?? []).map((d: Record<string, unknown>) => ({ name: d.name as string, value: Number(d.value) }));
}

export async function getProfileDetails(
  legislatorId: number,
  periodId: string,
) {
  "use cache";
  cacheLife("hours");
  cacheTag("profile");
  cacheTag(`profile:${legislatorId}:${periodId}`);

  if (periodId === "legislature") {
    const periods = await getPeriods();
    const annualPeriods = periods.filter((p) => p.id !== "legislature");
    const [identity, ...allPeriodDetails] = await Promise.all([
      getProfileIdentity(legislatorId),
      ...annualPeriods.map((p) =>
        getProfilePeriodDetails(legislatorId, p.id),
      ),
    ]);
    const validPeriods = allPeriodDetails.filter((p): p is ProfilePeriodDetails => p !== null);

    if (validPeriods.length === 0) {
      return { identity, period: null };
    }

    return {
      identity,
      period: mergePeriods(legislatorId, validPeriods),
    };
  }

  const [identity, periodDetails] = await Promise.all([
    getProfileIdentity(legislatorId),
    getProfilePeriodDetails(legislatorId, periodId),
  ]);
  return { identity, period: periodDetails };
}

async function getProfileIdentity(legislatorId: number): Promise<ProfileIdentityDetails> {
  const [detailsResult, staffResult, assetsResult] = await Promise.all([
    supabase
      .from("legislator_details")
      .select("*")
      .eq("legislator_id", legislatorId)
      .single(),
    supabase
      .from("legislator_staff")
      .select("name, role, start_date")
      .eq("legislator_id", legislatorId),
    supabase
      .from("legislator_assets")
      .select("type, description, value")
      .eq("legislator_id", legislatorId),
  ]);

  const details = detailsResult.data as Record<string, unknown> | null;

  return {
    id: legislatorId,
    birthDate: (details?.birth_date as string) ?? null,
    birthPlace: (details?.birth_place as string) ?? null,
    education: (details?.education as string) ?? null,
    office: (details?.office as string) ?? null,
    staff: (staffResult.data ?? []).map((s: Record<string, unknown>) => ({
      name: s.name as string,
      role: (s.role as string) ?? "",
      startDate: s.start_date as string | null,
    })),
    assets: (assetsResult.data ?? []).map((a: Record<string, unknown>) => ({
      type: a.type as string,
      description: (a.description as string) ?? "",
      value: Number(a.value),
    })),
  };
}

function mergePeriods(
  deputyId: number,
  periods: ProfilePeriodDetails[],
): ProfilePeriodDetails {
  const categories = new Map<string, { total: number; documents: number }>();
  const suppliers = new Map<
    string,
    { name: string; taxId: string | null; total: number; documents: number }
  >();

  for (const period of periods) {
    for (const category of period.expenseCategories) {
      const current = categories.get(category.name) || {
        total: 0,
        documents: 0,
      };
      current.total += category.total;
      current.documents += category.documents;
      categories.set(category.name, current);
    }
    for (const supplier of period.suppliers) {
      const key = supplier.taxId || supplier.name;
      const current = suppliers.get(key) || {
        name: supplier.name,
        taxId: supplier.taxId,
        total: 0,
        documents: 0,
      };
      current.total += supplier.total;
      current.documents += supplier.documents;
      suppliers.set(key, current);
    }
  }

  return {
    id: deputyId,
    expenseCategories: [...categories.entries()]
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    suppliers: [...suppliers.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    largestExpenses: periods
      .flatMap((period) => period.largestExpenses)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    proposals: Array.from(
      new Map(
        periods
          .flatMap((period) => period.proposals)
          .map((proposal) => [proposal.id, proposal]),
      ).values(),
    ).sort((a, b) => b.date.localeCompare(a.date)),
    publicVotes: periods
      .flatMap((period) => period.publicVotes || [])
      .sort(
        (a, b) =>
          Number(b.classification !== "unanalyzed") - Number(a.classification !== "unanalyzed") ||
          Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta) ||
          b.date.localeCompare(a.date),
      ),
    amendments: periods
      .flatMap((period) => period.amendments)
      .sort(
        (a, b) =>
          b.transferredValue +
          b.proposedValue -
          (a.transferredValue + a.proposedValue),
      )
      .slice(0, 10),
  };
}

async function getProfilePeriodDetails(
  legislatorId: number,
  periodId: string,
): Promise<ProfilePeriodDetails | null> {
  const [expenseCategories, suppliers, largestExpenses, proposals, votes, amendments] =
    await Promise.all([
      getExpenseCategories(legislatorId, periodId),
      getSuppliers(legislatorId, periodId),
      getLargestExpenses(legislatorId, periodId),
      getDeputyProposals(legislatorId, periodId),
      getDeputyVotes(legislatorId, periodId),
      getAmendments(legislatorId, periodId),
    ]);

  return {
    id: legislatorId,
    expenseCategories,
    suppliers,
    largestExpenses,
    proposals,
    publicVotes: votes,
    amendments,
  };
}

async function getExpenseCategories(legislatorId: number, periodId: string) {
  const { data } = await supabase
    .from("legislator_period_expense_categories")
    .select("name, total, documents")
    .eq("legislator_id", legislatorId)
    .eq("period_id", periodId)
    .order("total", { ascending: false });
  return (data ?? []).map((d: Record<string, unknown>) => ({
    name: d.name as string,
    total: Number(d.total),
    documents: d.documents as number,
  }));
}

async function getSuppliers(legislatorId: number, periodId: string) {
  const { data } = await supabase
    .from("legislator_period_suppliers")
    .select("name, tax_id, total, documents")
    .eq("legislator_id", legislatorId)
    .eq("period_id", periodId)
    .order("total", { ascending: false })
    .limit(10);
  return (data ?? []).map((d: Record<string, unknown>) => ({
    name: d.name as string,
    taxId: d.tax_id as string | null,
    total: Number(d.total),
    documents: d.documents as number,
  }));
}

async function getLargestExpenses(legislatorId: number, periodId: string) {
  const { data } = await supabase
    .from("legislator_period_largest_expenses")
    .select("category, supplier, expense_date, value, document_url")
    .eq("legislator_id", legislatorId)
    .eq("period_id", periodId)
    .order("value", { ascending: false })
    .limit(10);
  return (data ?? []).map((d: Record<string, unknown>) => ({
    category: d.category as string,
    supplier: (d.supplier as string) ?? "",
    date: (d.expense_date as string) ?? "",
    value: Number(d.value),
    documentUrl: d.document_url as string | null,
  }));
}

async function getDeputyProposals(legislatorId: number, periodId: string) {
  const { data } = await supabase
    .from("legislator_proposals")
    .select("proposal_id, participation_role, participation_label, proposal_nature, proposal_nature_label, proposals(id, type, number, year, proposal_date, summary, status, url)")
    .eq("legislator_id", legislatorId)
    .eq("period_id", periodId);

  if (!data) return [];

  const proposalIds = data.map((row: Record<string, unknown>) => row.proposal_id as string).filter(Boolean);
  const { data: reviewedClassifications } = proposalIds.length > 0
    ? await supabase
        .from("proposal_classifications")
        .select("proposal_id, category, confidence, justification, source, analysis_level, methodology_version, analysis_method_version, legislative_type, decision_nature, decision_scope, declared_benefit, hidden_cost, net_public_effect, has_tradeoff, summary_matches_text, risk_flags, critical_articles, analysis_payload")
        .in("proposal_id", proposalIds)
    : { data: [] as Record<string, unknown>[] | null };

  const classMap = new Map((reviewedClassifications ?? []).map((c: Record<string, unknown>) => [c.proposal_id as string, c]));

  return data.map((row: Record<string, unknown>) => {
    const proposal = row.proposals as Record<string, unknown> | null;
    const summary = (proposal?.summary as string) ?? "";
    const reviewedCls = classMap.get(row.proposal_id as string);
    const classification: ProposalClassification | null = reviewedCls
      ? {
          category: reviewedCls.category as PublicValueCategory,
          confidence: reviewedCls.confidence as ClassificationConfidence,
          justification: reviewedCls.justification as string,
          source: reviewedCls.source as "reviewed" | "rule" | "llm",
          analysisLevel: (reviewedCls.analysis_level as 1 | 2 | 3 | null) ?? 2,
          methodologyVersion: reviewedCls.methodology_version as string,
          analysisMethodVersion: reviewedCls.analysis_method_version as string,
          legislativeType: reviewedCls.legislative_type as ProposalClassification["legislativeType"],
          decisionNature: reviewedCls.decision_nature as ProposalClassification["decisionNature"],
          decisionScope: reviewedCls.decision_scope as ProposalClassification["decisionScope"],
          declaredBenefit: reviewedCls.declared_benefit as string,
          hiddenCost: reviewedCls.hidden_cost as string,
          netPublicEffect: reviewedCls.net_public_effect as ProposalClassification["netPublicEffect"],
          hasTradeoff: reviewedCls.has_tradeoff as boolean,
          summaryMatchesText: reviewedCls.summary_matches_text as ProposalClassification["summaryMatchesText"],
          riskFlags: (reviewedCls.risk_flags as RiskFlag[] | null) ?? [],
          criticalArticles: (reviewedCls.critical_articles as CriticalArticle[] | null) ?? [],
          analysisPayload: reviewedCls.analysis_payload as Record<string, unknown>,
        }
      : classifyProposal(row.proposal_id as string, summary);

    return {
      id: row.proposal_id as string,
      type: (proposal?.type as string) ?? "",
      number: (proposal?.number as string) ?? "",
      year: (proposal?.year as string) ?? "",
      date: (proposal?.proposal_date as string) ?? "",
      summary,
      status: (proposal?.status as string) ?? "",
      url: (proposal?.url as string) ?? "",
      participationRole: row.participation_role as string,
      participationLabel: row.participation_label as string,
      proposalNature: row.proposal_nature as string,
      proposalNatureLabel: row.proposal_nature_label as string,
      ...(classification ? { publicValue: classifyProposalFull(row.proposal_id as string, summary, row.participation_role as ParticipationRole, row.proposal_nature as ProposalNature, classification) } : {}),
    };
  });
}

function classifyProposalFull(proposalId: string, summary: string, _role: ParticipationRole, _nature: ProposalNature, classification?: ProposalClassification | null) {
  if (!classification) return null;

  const category = classification.category;
  const catInfo = PUBLIC_VALUE_CATEGORIES[category];

  return {
    category,
    categoryLabel: catInfo.label,
    categoryWeight: catInfo.weight,
    confidence: classification.confidence,
    justification: classification.justification,
    source: classification.source,
    analysisLevel: classification.analysisLevel,
    stage: "presented" as ProposalStage,
    stageMultiplier: 0.25,
    points: catInfo.weight * 0.25,
    methodologyVersion: classification.methodologyVersion,
    analysisMethodVersion: classification.analysisMethodVersion,
    legislativeType: classification.legislativeType,
    decisionNature: classification.decisionNature,
    decisionScope: classification.decisionScope,
    declaredBenefit: classification.declaredBenefit,
    hiddenCost: classification.hiddenCost,
    netPublicEffect: classification.netPublicEffect,
    hasTradeoff: classification.hasTradeoff,
    summaryMatchesText: classification.summaryMatchesText,
    riskFlags: classification.riskFlags ?? [],
    criticalArticles: classification.criticalArticles ?? [],
    roleWeight: 1.0,
    natureWeight: 1.0,
    progressBonus: 0,
    scoreExplanation: "",
  };
}

async function getDeputyVotes(legislatorId: number, periodId: string) {
  const { data } = await supabase
    .from("legislator_votes")
    .select("vote_id, candidate_vote, score_delta, score_points, affects_score, analysis_status, needs_strong_review, review_reason, coverage_category, score_safety_reason, model_used, model_role, confidence, reason, source, reviewed_manually, votes(id, vote_date, description, summary, url)")
    .eq("legislator_id", legislatorId)
    .eq("period_id", periodId);

  if (!data) return [];

  const { data: classifications } = await supabase
    .from("vote_classifications")
    .select("vote_id, classification, severity, source, analysis_level, reviewed_manually, analysis_method_version, legislative_type, decision_nature, decision_scope, vote_object_type, vote_object_description, yes_means, no_means, analyzed_text_matches_vote_object, score_impact_limit, is_procedural_vote, declared_benefit, hidden_cost, net_public_effect, has_tradeoff, summary_matches_text, risk_flags, critical_articles, analysis_payload, model_used, model_role, analysis_status, risk_level, needs_strong_review, review_reason, coverage_category, affects_score, score_safety_reason")
    .in("vote_id", data.map((r: Record<string, unknown>) => r.vote_id));

  const classMap = new Map((classifications ?? []).map((c: Record<string, unknown>) => [c.vote_id as string, c]));

  return data
    .map((row: Record<string, unknown>) => {
      const vote = row.votes as Record<string, unknown> | null;
      const cls = classMap.get(row.vote_id as string) as Record<string, unknown> | undefined;
      const payload = (cls?.analysis_payload && typeof cls.analysis_payload === "object"
        ? cls.analysis_payload
        : {}) as Record<string, unknown>;
      const hasLinkAnalysis =
        row.confidence !== null ||
        Boolean(row.reason) ||
        Boolean(row.source) ||
        Boolean(row.reviewed_manually) ||
        Number(row.score_delta) !== 0;
      return {
        voteId: row.vote_id as string,
        date: (vote?.vote_date as string) ?? "",
        description: (vote?.description as string) ?? "",
        summary: (vote?.summary as string) ?? "",
        url: (vote?.url as string) ?? "",
        candidateVote: row.candidate_vote as string,
        classification: (cls?.classification as string) ?? (hasLinkAnalysis ? "analyzed" : "unanalyzed"),
        severity: (cls?.severity as string) ?? "",
        scoreDelta: Number(row.score_delta),
        scorePoints: row.score_points === null || row.score_points === undefined ? null : Number(row.score_points),
        affectsScore: ((row.affects_score as boolean | null) ?? (cls?.affects_score as boolean | null)) ?? false,
        analysisStatus: ((row.analysis_status as string | null) ?? (cls?.analysis_status as string | null)) ?? "",
        riskLevel: (cls?.risk_level as string) ?? "",
        needsStrongReview: ((row.needs_strong_review as boolean | null) ?? (cls?.needs_strong_review as boolean | null)) ?? false,
        reviewReason: ((row.review_reason as string | null) ?? (cls?.review_reason as string | null)) ?? "",
        coverageCategory: ((row.coverage_category as string | null) ?? (cls?.coverage_category as string | null)) ?? "",
        confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
        reason: (row.reason as string) ?? "",
        source: (cls?.source as string) ?? (row.source as string) ?? "",
        analysisLevel: (cls?.analysis_level as 1 | 2 | 3 | null) ?? null,
        reviewedManually: ((cls?.reviewed_manually as boolean | null) ?? (row.reviewed_manually as boolean)) ?? false,
        analysisMethodVersion: (cls?.analysis_method_version as string) ?? "",
        legislativeType: (cls?.legislative_type as string) ?? "",
        decisionNature: (cls?.decision_nature as string) ?? "",
        decisionScope: (cls?.decision_scope as string) ?? "",
        voteObjectType: (cls?.vote_object_type as string) ?? "",
        voteObjectSubtype: (payload.voteObjectSubtype as string) ?? "",
        voteObjectDescription: (cls?.vote_object_description as string) ?? "",
        yesMeans: (cls?.yes_means as string) ?? "",
        noMeans: (cls?.no_means as string) ?? "",
        voteObjectTextFound: (payload.voteObjectTextFound as boolean | null) ?? false,
        primaryTextUsed: (payload.primaryTextUsed as string) ?? "",
        usedRelatedBillAsMainEvidence: (payload.usedRelatedBillAsMainEvidence as boolean | null) ?? false,
        analyzedTextMatchesVoteObject: (cls?.analyzed_text_matches_vote_object as string) ?? "",
        scoreImpactLimit: (cls?.score_impact_limit as string) ?? "",
        recommendedScoreImpact: typeof payload.recommendedScoreImpact === "number" ? payload.recommendedScoreImpact : null,
        scoreSafetyReason: ((row.score_safety_reason as string | null) ?? (cls?.score_safety_reason as string | null) ?? (payload.scoreSafetyReason as string)) ?? "",
        modelRecommendation: (payload.modelRecommendation as string) ?? "",
        modelUsed: ((row.model_used as string | null) ?? (cls?.model_used as string | null) ?? (payload.modelUsed as string)) ?? "",
        modelRole: ((row.model_role as string | null) ?? (cls?.model_role as string | null) ?? (payload.modelRole as string)) ?? "",
        isProceduralVote: (cls?.is_procedural_vote as boolean | null) ?? false,
        declaredBenefit: (cls?.declared_benefit as string) ?? "",
        hiddenCost: (cls?.hidden_cost as string) ?? "",
        netPublicEffect: (cls?.net_public_effect as string) ?? "",
        hasTradeoff: (cls?.has_tradeoff as boolean | null) ?? false,
        summaryMatchesText: (cls?.summary_matches_text as string) ?? "",
        riskFlags: (cls?.risk_flags as string[] | null) ?? [],
        criticalArticles: (cls?.critical_articles as Array<{ article: string; issue: string }> | null) ?? [],
      };
    })
    .sort(
      (a, b) =>
        Number(b.classification !== "unanalyzed") - Number(a.classification !== "unanalyzed") ||
        Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta) ||
        b.date.localeCompare(a.date),
    );
}

async function getAmendments(legislatorId: number, periodId: string) {
  const { data } = await supabase
    .from("legislator_amendments")
    .select("number, year, type, beneficiary, proposed_value, transferred_value")
    .eq("legislator_id", legislatorId)
    .eq("period_id", periodId)
    .order("transferred_value", { ascending: false })
    .limit(10);
  return (data ?? []).map((d: Record<string, unknown>) => ({
    number: (d.number as string) ?? "",
    year: (d.year as string) ?? "",
    type: (d.type as string) ?? "",
    beneficiary: (d.beneficiary as string) ?? "",
    proposedValue: Number(d.proposed_value ?? 0),
    transferredValue: Number(d.transferred_value ?? 0),
  }));
}
