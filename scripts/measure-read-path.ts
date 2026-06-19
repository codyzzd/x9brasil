import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE_SIZE = 1000;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type SupabaseSelectQuery = ReturnType<ReturnType<typeof supabase.from>["select"]>;

type TimedResult<T> = {
  label: string;
  ms: number;
  result: T;
};

async function timed<T>(label: string, fn: () => Promise<T>): Promise<TimedResult<T>> {
  const started = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - started);
  console.log(`${label}: ${ms}ms`);
  return { label, ms, result };
}

async function fetchAllRows(
  table: string,
  select = "*",
  configure?: (query: SupabaseSelectQuery) => SupabaseSelectQuery,
) {
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const base = supabase.from(table).select(select);
    const query = configure ? configure(base) : base;
    const { data, error } = await query.range(from, to);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function countRows(table: string) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function firstLegislator(slug?: string) {
  let query = supabase
    .from("legislators")
    .select("id, slug, name")
    .order("name")
    .limit(1);

  if (slug) {
    query = supabase
      .from("legislators")
      .select("id, slug, name")
      .eq("slug", slug)
      .limit(1);
  }

  const { data, error } = await query;
  if (error) throw new Error(`legislators: ${error.message}`);
  const row = data?.[0];
  if (!row) throw new Error(`No legislator found${slug ? ` for slug ${slug}` : ""}`);
  return row as { id: number; slug: string; name: string };
}

async function measureSnapshotRead() {
  const tables = [
    "legislators",
    "periods",
    "legislator_period_metrics",
    "legislator_period_top_donors",
    "legislator_period_top_campaign_suppliers",
  ];

  const counts = await Promise.all(tables.map(async (table) => [table, await countRows(table)] as const));
  console.log("\nSnapshot row counts:");
  for (const [table, count] of counts) console.log(`  ${table}: ${count}`);

  const baseReads = await Promise.all([
    timed("snapshot legislators", () => fetchAllRows("legislators", "id, slug, name")),
    timed("snapshot periods", () => fetchAllRows("periods", "*")),
    timed("snapshot metrics", () => fetchAllRows("legislator_period_metrics", "*")),
  ]);

  const metrics = baseReads.find((read) => read.label === "snapshot metrics")?.result ?? [];
  const materialized = hasCampaignFinanceMaterialization(metrics);
  console.log(`Campaign finance indicators materialized: ${materialized ? "yes" : "no"}`);

  const campaignReads = materialized
    ? []
    : await Promise.all([
        timed("snapshot donors", () => fetchAllRows("legislator_period_top_donors", "legislator_id, period_id, name, value")),
        timed("snapshot campaign suppliers", () =>
          fetchAllRows("legislator_period_top_campaign_suppliers", "legislator_id, period_id, name, value"),
        ),
      ]);

  const reads = [...baseReads, ...campaignReads];
  const totalMs = Math.max(...reads.map((read) => read.ms));
  const totalRows = reads.reduce((sum, read) => sum + read.result.length, 0);
  console.log(`Snapshot parallel read wall time: ~${totalMs}ms for ${totalRows} rows`);
}

function hasCampaignFinanceMaterialization(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return false;
  return "campaign_donor_top3_share" in rows[0]
    && "campaign_supplier_top3_share" in rows[0]
    && "campaign_donors_count" in rows[0]
    && "campaign_suppliers_count" in rows[0];
}

async function measureProfileRead(legislatorId: number, periodId: string) {
  const reads = await Promise.all([
    timed(`profile ${periodId} expense categories`, () =>
      fetchAllRows("legislator_period_expense_categories", "name, total, documents", (query) =>
        query.eq("legislator_id", legislatorId).eq("period_id", periodId).order("total", { ascending: false }),
      ),
    ),
    timed(`profile ${periodId} suppliers`, () =>
      fetchAllRows("legislator_period_suppliers", "name, tax_id, total, documents", (query) =>
        query.eq("legislator_id", legislatorId).eq("period_id", periodId).order("total", { ascending: false }).limit(10),
      ),
    ),
    timed(`profile ${periodId} largest expenses`, () =>
      fetchAllRows("legislator_period_largest_expenses", "category, supplier, expense_date, value, document_url", (query) =>
        query.eq("legislator_id", legislatorId).eq("period_id", periodId).order("value", { ascending: false }).limit(10),
      ),
    ),
    timed(`profile ${periodId} proposals`, () =>
      fetchAllRows(
        "legislator_proposals",
        "proposal_id, participation_role, participation_label, proposal_nature, proposal_nature_label, proposals(id, type, number, year, proposal_date, summary, status, url)",
        (query) => query.eq("legislator_id", legislatorId).eq("period_id", periodId),
      ),
    ),
    timed(`profile ${periodId} votes`, () =>
      fetchAllRows(
        "legislator_votes",
        "vote_id, candidate_vote, score_delta, score_points, affects_score, analysis_status, votes(id, vote_date, description, summary, url)",
        (query) => query.eq("legislator_id", legislatorId).eq("period_id", periodId),
      ),
    ),
    timed(`profile ${periodId} amendments`, () =>
      fetchAllRows("legislator_amendments", "*", (query) =>
        query.eq("legislator_id", legislatorId).eq("period_id", periodId),
      ),
    ),
    timed(`profile ${periodId} campaign donors`, () =>
      fetchAllRows("legislator_period_top_donors", "name, value", (query) =>
        query.eq("legislator_id", legislatorId).eq("period_id", periodId).order("value", { ascending: false }).limit(10),
      ),
    ),
    timed(`profile ${periodId} campaign suppliers`, () =>
      fetchAllRows("legislator_period_top_campaign_suppliers", "name, value", (query) =>
        query.eq("legislator_id", legislatorId).eq("period_id", periodId).order("value", { ascending: false }).limit(10),
      ),
    ),
  ]);

  const totalRows = reads.reduce((sum, read) => sum + read.result.length, 0);
  const wallMs = Math.max(...reads.map((read) => read.ms));
  console.log(`Profile ${periodId} parallel read wall time: ~${wallMs}ms for ${totalRows} base rows`);
  return { wallMs, totalRows };
}

async function measureProfileCombinedLegislatureRead(legislatorId: number, periodIds: string[]) {
  const reads = await Promise.all([
    timed("profile legislature expense categories", () =>
      fetchAllRows("legislator_period_expense_categories", "name, total, documents", (query) =>
        query.eq("legislator_id", legislatorId).in("period_id", periodIds),
      ),
    ),
    timed("profile legislature suppliers", () =>
      fetchAllRows("legislator_period_suppliers", "name, tax_id, total, documents", (query) =>
        query.eq("legislator_id", legislatorId).in("period_id", periodIds),
      ),
    ),
    timed("profile legislature largest expenses", () =>
      fetchAllRows("legislator_period_largest_expenses", "category, supplier, expense_date, value, document_url", (query) =>
        query.eq("legislator_id", legislatorId).in("period_id", periodIds).order("value", { ascending: false }).limit(10),
      ),
    ),
    timed("profile legislature proposals", () =>
      fetchAllRows(
        "legislator_proposals",
        "proposal_id, participation_role, participation_label, proposal_nature, proposal_nature_label, proposals(id, type, number, year, proposal_date, summary, status, url)",
        (query) => query.eq("legislator_id", legislatorId).in("period_id", periodIds),
      ),
    ),
    timed("profile legislature votes", () =>
      fetchAllRows(
        "legislator_votes",
        "vote_id, candidate_vote, score_delta, score_points, affects_score, analysis_status, votes(id, vote_date, description, summary, url)",
        (query) => query.eq("legislator_id", legislatorId).in("period_id", periodIds),
      ),
    ),
    timed("profile legislature amendments", () =>
      fetchAllRows("legislator_amendments", "*", (query) =>
        query.eq("legislator_id", legislatorId).in("period_id", periodIds).order("transferred_value", { ascending: false }).limit(10),
      ),
    ),
    timed("profile legislature campaign donors", () =>
      fetchAllRows("legislator_period_top_donors", "name, value", (query) =>
        query.eq("legislator_id", legislatorId).in("period_id", periodIds),
      ),
    ),
    timed("profile legislature campaign suppliers", () =>
      fetchAllRows("legislator_period_top_campaign_suppliers", "name, value", (query) =>
        query.eq("legislator_id", legislatorId).in("period_id", periodIds),
      ),
    ),
  ]);

  const totalRows = reads.reduce((sum, read) => sum + read.result.length, 0);
  const wallMs = Math.max(...reads.map((read) => read.ms));
  console.log(`Profile legislature combined base read wall time: ~${wallMs}ms for ${totalRows} base rows`);
  return { wallMs, totalRows };
}

async function main() {
  const slug = process.argv[2];
  const legislator = await timed("select legislator", () => firstLegislator(slug));
  console.log(`\nLegislator: ${legislator.result.name} (${legislator.result.slug}, ${legislator.result.id})`);

  await measureSnapshotRead();

  const periods = await timed("read periods for profile", () => fetchAllRows("periods", "id", (query) => query.order("start_date")));
  const annualPeriods = periods.result.map((period) => period.id as string).filter((id) => id !== "legislature");

  console.log("\nProfile annual reads used to compose Legislatura completa:");
  let profileRows = 0;
  let profileSequentialMs = 0;
  for (const periodId of annualPeriods) {
    const result = await measureProfileRead(legislator.result.id, periodId);
    profileRows += result.totalRows;
    profileSequentialMs += result.wallMs;
  }

  console.log("\nSummary:");
  console.log(`  Annual periods composed for legislature profile: ${annualPeriods.length}`);
  console.log(`  Profile base rows read across annual periods: ${profileRows}`);
  console.log(`  Approx sequential profile read wall time: ${profileSequentialMs}ms`);

  console.log("\nProfile combined read used by optimized Legislatura completa:");
  await measureProfileCombinedLegislatureRead(legislator.result.id, annualPeriods);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
