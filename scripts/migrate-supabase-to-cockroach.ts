import { loadEnvConfig } from "@next/env";
import pg from "pg";

loadEnvConfig(process.cwd());

const { Client } = pg;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const START_TABLE = process.env.START_TABLE;
const PAGE_SIZE = 1000;
const INSERT_BATCH_SIZE = 250;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !DATABASE_URL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL");
  process.exit(1);
}

type Row = Record<string, unknown>;

const tables: Array<{ name: string; order: string; conflict: string[] }> = [
  { name: "legislators", order: "id", conflict: ["id"] },
  { name: "periods", order: "id", conflict: ["id"] },
  { name: "legislator_details", order: "legislator_id", conflict: ["legislator_id"] },
  { name: "legislator_assets", order: "id", conflict: ["id"] },
  { name: "legislator_staff", order: "id", conflict: ["id"] },
  { name: "legislator_period_metrics", order: "id", conflict: ["id"] },
  { name: "legislator_period_top_donors", order: "id", conflict: ["id"] },
  { name: "legislator_period_top_campaign_suppliers", order: "id", conflict: ["id"] },
  { name: "legislator_period_expense_categories", order: "id", conflict: ["id"] },
  { name: "legislator_period_suppliers", order: "id", conflict: ["id"] },
  { name: "legislator_period_largest_expenses", order: "id", conflict: ["id"] },
  { name: "proposals", order: "id", conflict: ["id"] },
  { name: "legislator_proposals", order: "id", conflict: ["id"] },
  { name: "proposal_classifications", order: "proposal_id", conflict: ["proposal_id"] },
  { name: "votes", order: "id", conflict: ["id"] },
  { name: "vote_classifications", order: "id", conflict: ["id"] },
  { name: "legislator_votes", order: "id", conflict: ["id"] },
  { name: "legislator_amendments", order: "id", conflict: ["id"] },
  { name: "snapshot_metadata", order: "id", conflict: ["id"] },
  { name: "sources", order: "id", conflict: ["id"] },
  { name: "classification_runs", order: "created_at", conflict: ["id"] },
  { name: "classification_run_items", order: "id", conflict: ["id"] },
];

const jsonbColumns = new Set([
  "analysis_payload",
  "critical_articles",
  "risk_flags",
]);

function quoteIdentifier(identifier: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function fetchRows(table: string, order: string, from: number, to: number) {
  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
  url.searchParams.set("select", "*");
  url.searchParams.set("order", `${order}.asc`);

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Range: `${from}-${to}`,
      Prefer: "count=exact",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${table}: ${response.status} ${response.statusText} ${body}`);
  }

  const rows = await response.json() as Row[];
  return rows.map(normalizeJsonbColumns);
}

function normalizeJsonbColumns(row: Row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (!jsonbColumns.has(key) || typeof value !== "string") return [key, value];
      if (value.startsWith("{") && value.endsWith("}") && !value.includes(":")) {
        const items = value
          .slice(1, -1)
          .split(",")
          .map((item) => item.replace(/^"|"$/g, ""))
          .filter(Boolean);
        return [key, items];
      }
      try {
        return [key, JSON.parse(value)];
      } catch {
        return [key, value];
      }
    }),
  );
}

function serializeValue(column: string, value: unknown) {
  if (!jsonbColumns.has(column) || value === null || value === undefined) return value;
  return JSON.stringify(value);
}

async function upsertRows(client: pg.Client, table: string, rows: Row[], conflictColumns: string[]) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const updateColumns = columns.filter((column) => !conflictColumns.includes(column));

  for (const batch of chunks(rows, INSERT_BATCH_SIZE)) {
    const values: unknown[] = [];
    const valueGroups = batch.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(serializeValue(column, row[column]));
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const conflict = updateColumns.length > 0
      ? `DO UPDATE SET ${updateColumns.map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`).join(", ")}`
      : "DO NOTHING";
    const sql = [
      `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")})`,
      `VALUES ${valueGroups.join(", ")}`,
      `ON CONFLICT (${conflictColumns.map(quoteIdentifier).join(", ")}) ${conflict}`,
    ].join(" ");
    await client.query(sql, values);
  }
}

async function migrateTable(client: pg.Client, table: typeof tables[number]) {
  let total = 0;
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const rows = await fetchRows(table.name, table.order, from, to);
    await upsertRows(client, table.name, rows, table.conflict);
    total += rows.length;
    if (rows.length > 0) console.log(`${table.name}: ${total}`);
    if (rows.length < PAGE_SIZE) break;
  }
  if (total === 0) console.log(`${table.name}: 0`);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  const startIndex = START_TABLE
    ? tables.findIndex((table) => table.name === START_TABLE)
    : 0;
  if (startIndex === -1) {
    throw new Error(`Unknown START_TABLE: ${START_TABLE}`);
  }
  await client.connect();
  try {
    for (const table of tables.slice(startIndex)) {
      await migrateTable(client, table);
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
