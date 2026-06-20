import { loadEnvConfig } from "@next/env";
import { parse } from "csv-parse";
import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";
import { createClient } from "../src/lib/database/client";

loadEnvConfig(process.cwd());

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable");
  process.exit(1);
}

const supabase = createClient();

type CsvRow = Record<string, string | null>;

type Options = {
  file: string;
  table: string;
  batchSize: number;
  delimiter: string;
  encoding: BufferEncoding;
  zipEntry?: string;
  onConflict?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Partial<Options> = {
    batchSize: 1000,
    delimiter: ";",
    encoding: "utf8",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--file" && next) {
      options.file = next;
      index += 1;
    } else if (arg === "--table" && next) {
      options.table = next;
      index += 1;
    } else if (arg === "--batch-size" && next) {
      options.batchSize = Number(next);
      index += 1;
    } else if (arg === "--delimiter" && next) {
      options.delimiter = next;
      index += 1;
    } else if (arg === "--encoding" && next) {
      options.encoding = next as BufferEncoding;
      index += 1;
    } else if (arg === "--zip-entry" && next) {
      options.zipEntry = next;
      index += 1;
    } else if (arg === "--on-conflict" && next) {
      options.onConflict = next;
      index += 1;
    }
  }

  if (!options.file || !options.table || !Number.isFinite(options.batchSize)) {
    console.error([
      "Usage:",
      "  npm run data:db:ingest -- --file dados.csv --table staging_table",
      "  npm run data:db:ingest -- --file dados.zip --zip-entry arquivo.csv --table staging_table",
      "",
      "Optional: --batch-size 1000 --delimiter ';' --encoding latin1 --on-conflict id",
    ].join("\n"));
    process.exit(1);
  }

  return options as Options;
}

async function flush(table: string, rows: CsvRow[], onConflict?: string) {
  if (rows.length === 0) return;
  const query = supabase.from(table);
  const { error } = onConflict
    ? await query.upsert(rows, { onConflict })
    : await query.insert(rows);
  if (error) throw new Error(`Failed to write ${rows.length} rows to ${table}: ${error.message}`);
}

function normalizeRow(row: Record<string, string>): CsvRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim(), value === "" ? null : value]),
  );
}

async function ingestStream(
  stream: NodeJS.ReadableStream,
  options: Options,
) {
  const parser = parse({
    bom: true,
    columns: true,
    delimiter: options.delimiter,
    relax_quotes: true,
    relax_column_count: true,
    encoding: options.encoding,
  });

  let rows: CsvRow[] = [];
  let total = 0;
  parser.on("data", (row: Record<string, string>) => {
    rows.push(normalizeRow(row));
    if (rows.length >= options.batchSize) {
      parser.pause();
      const batch = rows;
      rows = [];
      flush(options.table, batch, options.onConflict)
        .then(() => {
          total += batch.length;
          console.log(`Inserted ${total} rows into ${options.table}`);
          parser.resume();
        })
        .catch((error: unknown) => parser.destroy(error instanceof Error ? error : new Error(String(error))));
    }
  });

  await pipeline(stream, parser);
  await flush(options.table, rows, options.onConflict);
  total += rows.length;
  console.log(`Done. Inserted ${total} rows into ${options.table}`);
}

async function openZipEntry(file: string, entryMatch?: string) {
  return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError ?? new Error(`Could not open ${file}`));
        return;
      }

      zipFile.readEntry();
      zipFile.on("entry", (entry) => {
        const matches = entryMatch
          ? entry.fileName.includes(entryMatch)
          : entry.fileName.toLowerCase().endsWith(".csv");

        if (!matches || /\/$/.test(entry.fileName)) {
          zipFile.readEntry();
          return;
        }

        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            reject(streamError ?? new Error(`Could not read ${entry.fileName}`));
            return;
          }
          console.log(`Reading ${entry.fileName} from ${basename(file)}`);
          resolve(stream);
        });
      });

      zipFile.on("end", () => {
        reject(new Error(`No CSV entry matched ${entryMatch ?? "*.csv"} in ${file}`));
      });
      zipFile.on("error", reject);
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const stream = options.file.toLowerCase().endsWith(".zip")
    ? await openZipEntry(options.file, options.zipEntry)
    : createReadStream(options.file);
  await ingestStream(stream, options);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
