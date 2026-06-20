import pg from "pg";

const { Pool, types } = pg;

types.setTypeParser(20, (value: string) => Number(value));
types.setTypeParser(1700, (value: string) => Number(value));
types.setTypeParser(1082, (value: string) => value);
types.setTypeParser(1114, (value: string) => value);
types.setTypeParser(1184, (value: string) => value);

// Compatibility layer for the former untyped Supabase client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type Filter = { column: string; operator: "=" | "in"; value: unknown };
type Order = { column: string; ascending: boolean };
type SelectOptions = { count?: "exact"; head?: boolean };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryResult<T = any> = {
  data: T | null;
  error: Error | null;
  count?: number | null;
};

const jsonbColumns = new Set([
  "analysis_payload",
  "critical_articles",
  "risk_flags",
]);

let pool: InstanceType<typeof Pool> | null = null;

function getPool() {
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });
  return pool;
}

function databaseError() {
  return new Error("Missing DATABASE_URL environment variable");
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function splitTopLevel(input: string) {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function relationFor(table: string, relation: string) {
  if (table === "legislator_proposals" && relation === "proposals") {
    return { localColumn: "proposal_id", remoteTable: "proposals", remoteColumn: "id" };
  }
  if (table === "legislator_votes" && relation === "votes") {
    return { localColumn: "vote_id", remoteTable: "votes", remoteColumn: "id" };
  }
  throw new Error(`Unsupported nested select ${table}.${relation}`);
}

function parseSelect(table: string, select: string) {
  const baseColumns: string[] = [];
  const relations: Array<{ name: string; columns: string[]; localColumn: string; remoteTable: string; remoteColumn: string }> = [];

  for (const part of splitTopLevel(select)) {
    const relationMatch = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/);
    if (relationMatch) {
      const [, name, rawColumns] = relationMatch;
      relations.push({
        name,
        columns: splitTopLevel(rawColumns),
        ...relationFor(table, name),
      });
      continue;
    }
    baseColumns.push(part);
  }

  return { baseColumns, relations };
}

function buildWhere(filters: Filter[], values: unknown[], prefix = "base.") {
  if (filters.length === 0) return "";
  const clauses = filters.map((filter) => {
    values.push(filter.value);
    const placeholder = `$${values.length}`;
    const column = `${prefix}${quoteIdentifier(filter.column)}`;
    return filter.operator === "in"
      ? `${column} = ANY(${placeholder})`
      : `${column} = ${placeholder}`;
  });
  return ` WHERE ${clauses.join(" AND ")}`;
}

function mapRelationRows(rows: Row[], relations: ReturnType<typeof parseSelect>["relations"]) {
  if (relations.length === 0) return rows;

  return rows.map((row) => {
    const mapped: Row = { ...row };
    for (const relation of relations) {
      const relationRow: Row = {};
      let hasValue = false;
      for (const column of relation.columns) {
        const alias = `__${relation.name}__${column}`;
        relationRow[column] = mapped[alias];
        if (mapped[alias] !== null && mapped[alias] !== undefined) hasValue = true;
        delete mapped[alias];
      }
      mapped[relation.name] = hasValue ? relationRow : null;
    }
    return mapped;
  });
}

function serializeValue(column: string, value: unknown) {
  if (!jsonbColumns.has(column) || value === null || value === undefined || typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

async function runQuery<T = Row[]>(sql: string, values: unknown[]): Promise<QueryResult<T>> {
  const activePool = getPool();
  if (!activePool) return { data: null, error: databaseError() };
  try {
    const result = await activePool.query(sql, values);
    return { data: result.rows as T, error: null, count: result.rowCount };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

class SelectQuery {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private singleMode: "none" | "single" | "maybeSingle" = "none";

  constructor(
    private table: string,
    private selectValue: string,
    private options: SelectOptions = {},
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "=", value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ column, operator: "in", value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending ?? true });
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  range(from: number, to: number) {
    this.offsetValue = from;
    this.limitValue = Math.max(0, to - from + 1);
    return this;
  }

  single() {
    this.singleMode = "single";
    this.limitValue ??= 1;
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    this.limitValue ??= 1;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult> {
    const values: unknown[] = [];
    if (this.options.count === "exact" && this.options.head) {
      const where = buildWhere(this.filters, values);
      const result = await runQuery<{ count: string | number }[]>(
        `SELECT count(*) AS count FROM ${quoteIdentifier(this.table)} base${where}`,
        values,
      );
      if (result.error) return { data: null, error: result.error, count: null };
      return { data: null, error: null, count: Number(result.data?.[0]?.count ?? 0) };
    }

    const parsed = parseSelect(this.table, this.selectValue);
    const baseColumns = parsed.baseColumns.length === 0 || parsed.baseColumns.includes("*")
      ? ["base.*"]
      : parsed.baseColumns.map((column) => `base.${quoteIdentifier(column)}`);
    const relationColumns = parsed.relations.flatMap((relation) => (
      relation.columns.map((column) =>
        `${quoteIdentifier(relation.name)}.${quoteIdentifier(column)} AS ${quoteIdentifier(`__${relation.name}__${column}`)}`,
      )
    ));
    const joins = parsed.relations.map((relation) =>
      `LEFT JOIN ${quoteIdentifier(relation.remoteTable)} ${quoteIdentifier(relation.name)} ON base.${quoteIdentifier(relation.localColumn)} = ${quoteIdentifier(relation.name)}.${quoteIdentifier(relation.remoteColumn)}`,
    );
    const where = buildWhere(this.filters, values);
    const order = this.orders.length > 0
      ? ` ORDER BY ${this.orders.map((item) => `base.${quoteIdentifier(item.column)} ${item.ascending ? "ASC" : "DESC"}`).join(", ")}`
      : "";
    const limit = this.limitValue === undefined ? "" : ` LIMIT ${this.limitValue}`;
    const offset = this.offsetValue === undefined ? "" : ` OFFSET ${this.offsetValue}`;
    const sql = [
      `SELECT ${[...baseColumns, ...relationColumns].join(", ")}`,
      `FROM ${quoteIdentifier(this.table)} base`,
      joins.join(" "),
      where,
      order,
      limit,
      offset,
    ].join(" ");

    const result = await runQuery<Row[]>(sql, values);
    if (result.error) return result;
    const rows = mapRelationRows(result.data ?? [], parsed.relations);
    if (this.singleMode !== "none") {
      if (rows.length === 0) {
        return this.singleMode === "maybeSingle"
          ? { data: null, error: null, count: 0 }
          : { data: null, error: new Error("No rows returned"), count: 0 };
      }
      return { data: rows[0], error: null, count: rows.length };
    }
    return { data: rows, error: null, count: rows.length };
  }
}

class MutationQuery {
  private filters: Filter[] = [];
  private returning?: string;
  private singleMode = false;

  constructor(
    private table: string,
    private kind: "insert" | "upsert" | "update",
    private payload: Row | Row[],
    private options: { onConflict?: string } = {},
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "=", value });
    return this;
  }

  select(columns = "*") {
    this.returning = columns;
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult> {
    if (this.kind === "update") return this.executeUpdate();
    return this.executeInsert();
  }

  private async executeInsert(): Promise<QueryResult> {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    if (rows.length === 0) return { data: [], error: null, count: 0 };
    const columns = Object.keys(rows[0]);
    const values: unknown[] = [];
    const valueGroups = rows.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(serializeValue(column, row[column]));
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const conflictColumns = this.options.onConflict
      ?.split(",")
      .map((column) => column.trim())
      .filter(Boolean);
    const updateColumns = columns.filter((column) => !conflictColumns?.includes(column));
    const conflict = this.kind === "upsert" && conflictColumns && conflictColumns.length > 0
      ? updateColumns.length > 0
        ? ` ON CONFLICT (${conflictColumns.map(quoteIdentifier).join(", ")}) DO UPDATE SET ${
            updateColumns
              .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
              .join(", ")
          }`
        : ` ON CONFLICT (${conflictColumns.map(quoteIdentifier).join(", ")}) DO NOTHING`
      : "";
    const returning = this.returning ? ` RETURNING ${this.returning === "*" ? "*" : splitTopLevel(this.returning).map(quoteIdentifier).join(", ")}` : "";
    const sql = `INSERT INTO ${quoteIdentifier(this.table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES ${valueGroups.join(", ")}${conflict}${returning}`;
    const result = await runQuery<Row[]>(sql, values);
    if (result.error) return result;
    if (this.singleMode) return { data: result.data?.[0] ?? null, error: null, count: result.count };
    return result;
  }

  private async executeUpdate(): Promise<QueryResult> {
    const patch = this.payload as Row;
    const columns = Object.keys(patch);
    const values: unknown[] = [];
    const sets = columns.map((column) => {
      values.push(serializeValue(column, patch[column]));
      return `${quoteIdentifier(column)} = $${values.length}`;
    });
    const where = buildWhere(this.filters, values, "");
    const returning = this.returning ? ` RETURNING ${this.returning === "*" ? "*" : splitTopLevel(this.returning).map(quoteIdentifier).join(", ")}` : "";
    const sql = `UPDATE ${quoteIdentifier(this.table)} SET ${sets.join(", ")}${where}${returning}`;
    const result = await runQuery<Row[]>(sql, values);
    if (result.error) return result;
    if (this.singleMode) return { data: result.data?.[0] ?? null, error: null, count: result.count };
    return result;
  }
}

class DatabaseClient {
  from(table: string) {
    return {
      select: (columns = "*", options?: SelectOptions) => new SelectQuery(table, columns, options),
      insert: (payload: Row | Row[]) => new MutationQuery(table, "insert", payload),
      upsert: (payload: Row | Row[], options: { onConflict?: string } = {}) =>
        new MutationQuery(table, "upsert", payload, options),
      update: (payload: Row) => new MutationQuery(table, "update", payload),
    };
  }
}

export function createClient() {
  return new DatabaseClient();
}

export const db = createClient();
