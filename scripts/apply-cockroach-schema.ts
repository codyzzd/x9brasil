import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

loadEnvConfig(process.cwd());

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable");
  process.exit(1);
}

function splitStatements(sql: string) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  const migrationPath = resolve(process.cwd(), "cockroach/migrations/000001_initial_schema.sql");
  const sql = await readFile(migrationPath, "utf8");
  const statements = splitStatements(sql);
  const client = new Client({ connectionString: DATABASE_URL });

  await client.connect();
  try {
    for (const [index, statement] of statements.entries()) {
      await client.query(statement);
      console.log(`Applied ${index + 1}/${statements.length}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
