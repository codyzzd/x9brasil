import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and Supabase key");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type SnapshotData = {
  deputies: Array<{ id: number }>;
  periods: Array<{
    id: string;
    deputies: Array<{
      id: number;
      metrics: {
        topDonors?: Array<unknown>;
        topSuppliers?: Array<unknown>;
      };
    }>;
  }>;
  sources: Array<unknown>;
};

type ProfileData = {
  deputies: Array<{
    id: number;
    assets: Array<unknown>;
    staff: Array<unknown>;
  }>;
  periods: Array<{
    id: string;
    deputies: Array<{
      id: number;
      expenseCategories: Array<unknown>;
      suppliers: Array<unknown>;
      largestExpenses: Array<unknown>;
      amendments: Array<unknown>;
      proposals: Array<{
        id: string;
        participationRole: string;
        proposalNature: string;
      }>;
      publicVotes?: Array<{
        voteId: string;
        candidateVote: string;
      }>;
    }>;
  }>;
};

type ClassificationFile = {
  classifications?: Record<string, unknown>;
};

type CountExpectation = {
  table: string;
  expected: number;
  minimum?: number;
};

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

function buildExpectations(
  snapshot: SnapshotData,
  profile: ProfileData,
  proposalClassifications: ClassificationFile,
  voteClassifications: ClassificationFile,
): CountExpectation[] {
  const proposals = new Set<string>();
  const proposalLinks = new Set<string>();
  const votes = new Set<string>();
  const voteLinks = new Set<string>();
  let metrics = 0;
  let donors = 0;
  let campaignSuppliers = 0;
  let assets = 0;
  let staff = 0;
  let expenseCategories = 0;
  let suppliers = 0;
  let largestExpenses = 0;
  let amendments = 0;

  for (const deputy of profile.deputies) {
    assets += deputy.assets.length;
    staff += deputy.staff.length;
  }

  for (const period of snapshot.periods) {
    metrics += period.deputies.length;
    for (const deputy of period.deputies) {
      donors += deputy.metrics.topDonors?.length ?? 0;
      campaignSuppliers += deputy.metrics.topSuppliers?.length ?? 0;
    }
  }

  for (const period of profile.periods) {
    for (const deputy of period.deputies) {
      expenseCategories += deputy.expenseCategories.length;
      suppliers += deputy.suppliers.length;
      largestExpenses += deputy.largestExpenses.length;
      amendments += deputy.amendments.length;

      for (const proposal of deputy.proposals) {
        proposals.add(proposal.id);
        proposalLinks.add([
          deputy.id,
          proposal.id,
          period.id,
          proposal.participationRole,
          proposal.proposalNature,
        ].join("|"));
      }

      for (const vote of deputy.publicVotes ?? []) {
        votes.add(vote.voteId);
        voteLinks.add([
          deputy.id,
          vote.voteId,
          period.id,
          vote.candidateVote,
        ].join("|"));
      }
    }
  }

  for (const voteId of Object.keys(voteClassifications.classifications ?? {})) {
    votes.add(voteId);
  }

  return [
    { table: "legislators", expected: snapshot.deputies.length },
    { table: "periods", expected: snapshot.periods.length },
    { table: "legislator_period_metrics", expected: metrics },
    { table: "legislator_period_top_donors", expected: donors },
    { table: "legislator_period_top_campaign_suppliers", expected: campaignSuppliers },
    { table: "legislator_assets", expected: assets },
    { table: "legislator_staff", expected: staff },
    { table: "legislator_period_expense_categories", expected: expenseCategories },
    { table: "legislator_period_suppliers", expected: suppliers },
    { table: "legislator_period_largest_expenses", expected: largestExpenses },
    { table: "legislator_amendments", expected: amendments },
    { table: "proposals", expected: proposals.size, minimum: 1 },
    { table: "legislator_proposals", expected: proposalLinks.size, minimum: 1 },
    { table: "votes", expected: votes.size, minimum: 1 },
    { table: "legislator_votes", expected: voteLinks.size, minimum: 1 },
    {
      table: "proposal_classifications",
      expected: Object.keys(proposalClassifications.classifications ?? {}).length,
    },
    {
      table: "vote_classifications",
      expected: Object.keys(voteClassifications.classifications ?? {}).length,
    },
    { table: "sources", expected: snapshot.sources.length },
  ];
}

async function tableCount(table: string) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

async function fetchAll(table: string, columns: string) {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(start, start + pageSize - 1);
    if (error) throw new Error(`${table} fetch failed: ${error.message}`);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function duplicateReport(
  table: string,
  columns: string,
  keyFor: (row: Record<string, unknown>) => string,
) {
  const rows = await fetchAll(table, columns);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFor(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let duplicateGroups = 0;
  let extraRows = 0;
  for (const count of counts.values()) {
    if (count > 1) {
      duplicateGroups += 1;
      extraRows += count - 1;
    }
  }

  return { rows: rows.length, distinct: counts.size, duplicateGroups, extraRows };
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(scriptDir, "..", "src", "data");
  const snapshot = await readJson<SnapshotData>(join(dataDir, "ranking-snapshot.json"));
  const profile = await readJson<ProfileData>(join(dataDir, "profile-details.json"));
  const proposalClassifications = await readJson<ClassificationFile>(
    join(dataDir, "public-value-classifications.json"),
  );
  const voteClassifications = await readJson<ClassificationFile>(
    join(dataDir, "public-vote-classifications.json"),
  );

  let failed = false;
  console.log("Supabase parity counts");
  for (const expectation of buildExpectations(
    snapshot,
    profile,
    proposalClassifications,
    voteClassifications,
  )) {
    const actual = await tableCount(expectation.table);
    const matches = actual === expectation.expected;
    const meetsMinimum = expectation.minimum === undefined || actual >= expectation.minimum;
    const ok = matches && meetsMinimum;
    if (!ok) failed = true;
    console.log(
      `${ok ? "OK" : "FAIL"} ${expectation.table}: actual=${actual} expected=${expectation.expected}`,
    );
  }

  console.log("\nDuplicate checks");
  const duplicateChecks = [
    {
      table: "legislator_proposals",
      columns: "legislator_id,proposal_id,period_id,participation_role,proposal_nature",
      keyFor: (row: Record<string, unknown>) =>
        [row.legislator_id, row.proposal_id, row.period_id, row.participation_role, row.proposal_nature].join("|"),
    },
    {
      table: "legislator_votes",
      columns: "legislator_id,vote_id,period_id,candidate_vote",
      keyFor: (row: Record<string, unknown>) =>
        [row.legislator_id, row.vote_id, row.period_id, row.candidate_vote].join("|"),
    },
    {
      table: "legislator_period_metrics",
      columns: "legislator_id,period_id",
      keyFor: (row: Record<string, unknown>) => [row.legislator_id, row.period_id].join("|"),
    },
  ];

  for (const check of duplicateChecks) {
    const report = await duplicateReport(check.table, check.columns, check.keyFor);
    const ok = report.extraRows === 0;
    if (!ok) failed = true;
    console.log(
      `${ok ? "OK" : "FAIL"} ${check.table}: rows=${report.rows} distinct=${report.distinct} duplicate_groups=${report.duplicateGroups} extra_rows=${report.extraRows}`,
    );
  }

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
