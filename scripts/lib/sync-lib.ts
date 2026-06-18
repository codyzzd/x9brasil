import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { parse } from "csv-parse";
import AdmZip from "adm-zip";
import * as yauzl from "yauzl";
import type {
  DeputyIdentity,
  PeriodDeputyRecord,
  ProfileDetailsSnapshot,
  ProfilePeriodDetails,
  RankingPeriod,
  RankingSnapshot,
  RawMetrics,
} from "../../src/lib/ranking";
import {
  NATURE_WEIGHTS,
  PROGRESS_BONUS,
  PUBLIC_VALUE_CATEGORIES,
  ROLE_WEIGHTS,
  buildPublicVoteRecord,
  classifyProposal,
  getProposalWeight,
  normalizeProposalText,
  normalizePublicVote,
  proposalStageMultiplier,
  publicValueClassificationMetadata,
  type CandidateVote,
  type ParticipationRole,
  type ProposalNature,
  type PublicVoteAnalysis,
  type PublicVoteRecord,
  type ProposalStage,
} from "../../src/lib/public-value";

export const LEGISLATURE = 57;
export const PERIOD_START = "2023-02-01";
export const PERIOD_END = new Date().toISOString().slice(0, 10);
export const CURRENT_YEAR = Number(PERIOD_END.slice(0, 4));
export const YEARS = Array.from(
  { length: CURRENT_YEAR - 2022 },
  (_, index) => 2023 + index,
);
export const OUTPUT = new URL("../../.data/ranking-snapshot.json", import.meta.url);
export const PROFILE_OUTPUT = new URL(
  "../../.data/profile-details.json",
  import.meta.url,
);
export const PENDING_OUTPUT = new URL(
  "../../.data/public-value-classification-pending.json",
  import.meta.url,
);
export const PUBLIC_VOTE_PENDING_OUTPUT = new URL(
  "../../.data/public-vote-classification-pending.json",
  import.meta.url,
);
export const CHAMBER_API = "https://dadosabertos.camara.leg.br/api/v2";
export const CHAMBER_FILES = "https://dadosabertos.camara.leg.br/arquivos";
export const TSE_FILES = "https://cdn.tse.jus.br/estatistica/sead/odsele";
export const USER_AGENT = "ScoreBrasil/2.0";
export const BANNER_METADATA_OUTPUT = new URL(
  "../../.data/banner-metadata.json",
  import.meta.url,
);
export const CACHE_DIR = new URL("../.data-cache", import.meta.url);

export let useCache = !process.argv.includes("--fresh");
export function setUseCache(value: boolean) { useCache = value; }

export const STAGE_LABELS = [
  "Deputados",
  "Participação",
  "Votos públicos",
  "Produção",
  "Gastos parlamentares",
  "Dados TSE",
  "Votos eleitorais",
  "Finanças de campanha",
  "Servidores",
  "Emendas",
  "Compilando dados",
] as const;

let stageStart = performance.now();

export function logStage(current: number, label: string) {
  const elapsed = ((performance.now() - stageStart) / 1000).toFixed(1);
  console.log(`\n[${current}/${STAGE_LABELS.length}] ${label} (${elapsed}s)`);
  stageStart = performance.now();
}

export function logStageDone() {
  const elapsed = ((performance.now() - stageStart) / 1000).toFixed(1);
  console.log(`  ✓ (${elapsed}s)`);
}

export function cacheKey(url: string) {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export function cachePath(url: string, ext: string) {
  return new URL(`${cacheKey(url)}.${ext}`, CACHE_DIR);
}

export async function cachedDownload(
  url: string,
  ext: string,
  timeout: number,
): Promise<Buffer> {
  const cached = cachePath(url, ext);
  const label = url.slice(0, 80);
  if (useCache && existsSync(cached)) {
    console.log(`  Cache hit: ${label}`);
    return readFile(cached);
  }
  process.stdout.write(`  Baixando ${label}`);
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`${response.status} ao baixar ${url}`);
  if (!response.body) throw new Error("Response body is null");

  await mkdir(CACHE_DIR, { recursive: true });
  const tmp = new URL(`${cacheKey(url)}.${ext}.tmp`, CACHE_DIR);
  const writer = createWriteStream(tmp);

  const contentLength = Number(response.headers.get("content-length") || 0);
  let downloaded = 0;

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    downloaded += chunk.length;
    if (contentLength > 0) {
      const pct = Math.round((downloaded / contentLength) * 100);
      const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
      process.stdout.write(`\r  [${bar}] ${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(contentLength / 1024 / 1024).toFixed(1)}MB`);
    } else {
      process.stdout.write(`\r  ${(downloaded / 1024 / 1024).toFixed(1)}MB`);
    }
    writer.write(Buffer.from(chunk));
  }
  await new Promise<void>((resolve, reject) => {
    writer.end((err: unknown) => (err ? reject(err) : resolve()));
  });
  process.stdout.write("\n");
  await rename(tmp, cached);
  return readFile(cached);
}

export async function cachedDownloadPath(
  url: string,
  ext: string,
  timeout: number,
): Promise<URL> {
  const cached = cachePath(url, ext);
  const label = url.slice(0, 80);
  if (useCache && existsSync(cached)) {
    console.log(`  Cache hit: ${label}`);
    return cached;
  }
  process.stdout.write(`  Baixando ${label}`);
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`${response.status} ao baixar ${url}`);
  if (!response.body) throw new Error("Response body is null");

  await mkdir(CACHE_DIR, { recursive: true });
  const tmp = new URL(`${cacheKey(url)}.${ext}.tmp`, CACHE_DIR);
  const writer = createWriteStream(tmp);

  const contentLength = Number(response.headers.get("content-length") || 0);
  let downloaded = 0;

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    downloaded += chunk.length;
    if (contentLength > 0) {
      const pct = Math.round((downloaded / contentLength) * 100);
      const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
      process.stdout.write(`\r  [${bar}] ${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(contentLength / 1024 / 1024).toFixed(1)}MB`);
    } else {
      process.stdout.write(`\r  ${(downloaded / 1024 / 1024).toFixed(1)}MB`);
    }
    writer.write(Buffer.from(chunk));
  }
  await new Promise<void>((resolve, reject) => {
    writer.end((err: unknown) => (err ? reject(err) : resolve()));
  });
  process.stdout.write("\n");
  await rename(tmp, cached);
  return cached;
}

export async function readZipEntryBuffer(
  zipPath: URL,
  entryFilter: (name: string) => boolean,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath.pathname, { lazyEntries: true }, (err, zipFile) => {
      if (err || !zipFile) return reject(err || new Error("Failed to open zip"));

      zipFile.on("entry", (entry: yauzl.Entry) => {
        if (!entryFilter(entry.fileName)) {
          return zipFile.readEntry();
        }

        zipFile.openReadStream(entry, (openErr, stream) => {
          if (openErr || !stream) return reject(openErr || new Error("Failed to open entry stream"));

          const chunks: Buffer[] = [];

          stream.on("data", (chunk: Uint8Array) => {
            chunks.push(Buffer.from(chunk));
          });

          stream.on("end", () => {
            resolve(Buffer.concat(chunks));
          });

          stream.on("error", reject);
        });
      });

      zipFile.on("error", reject);
      zipFile.on("end", () => {
        reject(new Error("No matching entry found in zip"));
      });
      zipFile.readEntry();
    });
  });
}

export function parseCsvStream(
  rawStream: NodeJS.ReadableStream,
  encoding: "utf8" | "latin1",
  onRow: (row: CsvRow) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const csvParser = parse({
      bom: true,
      columns: true,
      delimiter: ";",
      relax_quotes: true,
      relax_column_count: true,
      encoding,
    });

    csvParser.on("data", (row: CsvRow) => onRow(row));

    const source = "pipe" in rawStream
      ? rawStream as NodeJS.ReadableStream
      : Readable.from(rawStream as AsyncIterable<Uint8Array>);

    pipeline(source, csvParser).then(resolve, reject);
  });
}

export async function forEachZipCsvEntry(
  zipPath: URL,
  entryFilter: (name: string) => boolean,
  encoding: "utf8" | "latin1",
  onRow: (row: CsvRow) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath.pathname, { lazyEntries: true }, (err, zipFile) => {
      if (err || !zipFile) return reject(err || new Error("Failed to open zip"));

      let done = false;

      const tryResolve = () => {
        if (done) resolve();
      };

      zipFile.on("entry", (entry: yauzl.Entry) => {
        if (!entryFilter(entry.fileName)) {
          return zipFile.readEntry();
        }

        zipFile.openReadStream(entry, (openErr, stream) => {
          if (openErr || !stream) return reject(openErr || new Error("Failed to open entry stream"));

          parseCsvStream(stream, encoding, onRow)
            .then(() => {
              zipFile.readEntry();
            })
            .catch(reject);
        });
      });

      zipFile.on("error", reject);
      zipFile.on("end", () => {
        done = true;
        resolve();
      });
      zipFile.readEntry();
    });
  });
}

export async function downloadAll() {
  const urls: Array<{ url: string; ext: string; timeout: number }> = [];

  for (const year of YEARS) {
    urls.push(
      { url: `${CHAMBER_FILES}/eventos/csv/eventos-${year}.csv`, ext: "csv", timeout: 300_000 },
      { url: `${CHAMBER_FILES}/eventosPresencaDeputados/csv/eventosPresencaDeputados-${year}.csv`, ext: "csv", timeout: 300_000 },
      { url: `${CHAMBER_FILES}/votacoesVotos/csv/votacoesVotos-${year}.csv`, ext: "csv", timeout: 300_000 },
      { url: `${CHAMBER_FILES}/votacoes/csv/votacoes-${year}.csv`, ext: "csv", timeout: 300_000 },
      { url: `${CHAMBER_FILES}/votacoesObjetos/csv/votacoesObjetos-${year}.csv`, ext: "csv", timeout: 300_000 },
      { url: `${CHAMBER_FILES}/proposicoes/csv/proposicoes-${year}.csv`, ext: "csv", timeout: 300_000 },
      { url: `${CHAMBER_FILES}/proposicoesAutores/csv/proposicoesAutores-${year}.csv`, ext: "csv", timeout: 300_000 },
      { url: `${CHAMBER_FILES}/proposicoesTramitacoes/csv/proposicoesTramitacoes-${year}.csv`, ext: "csv", timeout: 300_000 },
      { url: `https://www.camara.leg.br/cotas/Ano-${year}.csv.zip`, ext: "zip", timeout: 300_000 },
    );
  }

  urls.push(
    { url: `${CHAMBER_FILES}/funcionarios/csv/funcionarios.csv`, ext: "csv", timeout: 300_000 },
    { url: `${TSE_FILES}/consulta_cand/consulta_cand_2022.zip`, ext: "zip", timeout: 60_000 },
    { url: `${TSE_FILES}/bem_candidato/bem_candidato_2022.zip`, ext: "zip", timeout: 60_000 },
    { url: `${TSE_FILES}/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2022.zip`, ext: "zip", timeout: 600_000 },
    { url: "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip", ext: "zip", timeout: 600_000 },
    { url: "https://repositorio.dados.gov.br/seges/detru/siconv_emenda.csv.zip", ext: "zip", timeout: 300_000 },
  );

  const total = urls.length;
  for (let i = 0; i < total; i++) {
    const { url, ext, timeout } = urls[i];
    process.stdout.write(`[${i + 1}/${total}] `);
    await cachedDownload(url, ext, timeout);
  }
}

export type ChamberDeputy = {
  id: number;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  urlFoto: string;
  uri: string;
};

export type DeputyStatus = {
  dataHora: string;
  situacao: string | null;
  siglaPartido: string;
  siglaUf: string;
};

export type ExerciseInterval = {
  start: string;
  end: string;
  party: string;
  state: string;
};

export type PeriodAccumulator = {
  daysInOffice: number;
  officeStart: string;
  officeEnd: string;
  partyDays: Map<string, number>;
  stateDays: Map<string, number>;
  plenaryAttendances: Set<string>;
  plenarySessionsTotal: Set<string>;
  nominalVotes: Set<string>;
  nominalVotesTotal: Set<string>;
  substantiveProposals: Set<string>;
  oversightProposals: Set<string>;
  advancedProposals: Set<string>;
  convertedProposals: Set<string>;
  authorProposals: Set<string>;
  coauthorProposals: Set<string>;
  requesterProposals: Set<string>;
  fiscalizationProposals: Set<string>;
  expensesTotal: number;
  expenseDocuments: number;
  suppliers: Map<
    string,
    { name: string; taxId: string | null; total: number; documents: number }
  >;
  expenseCategories: Map<string, { total: number; documents: number }>;
  largestExpenses: Array<{
    category: string;
    supplier: string;
    date: string;
    value: number;
    documentUrl: string | null;
  }>;
  proposals: Map<
    string,
    {
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
    }
  >;
  amendments: Array<{
    number: string;
    year: string;
    type: string;
    beneficiary: string;
    proposedValue: number;
    transferredValue: number;
  }>;
  publicVotes: Array<PublicVoteProfileRecord>;
  allPublicVotes: Array<PublicVoteProfileRecord>;
};

export type PublicVoteProfileRecord = Omit<PublicVoteRecord, "confidence"> & {
  confidence: number | null;
  date: string;
  description: string;
  summary: string;
  url: string;
};

export type PublicVoteMetadata = {
  id: string;
  date: string;
  description: string;
  summary: string;
  url: string;
  analysis: PublicVoteAnalysis | null;
};

type ReviewedPublicVoteClassification = Omit<
  PublicVoteAnalysis,
  "voteId" | "source" | "reviewedManually" | "methodologyVersion"
> & {
  source?: "reviewed" | "rule" | "llm";
  analysisLevel?: 1 | 2 | 3;
  reviewedManually?: boolean;
};

export type DeputyAccumulator = {
  deputy: ChamberDeputy;
  civilName: string;
  intervals: ExerciseInterval[];
  periods: Map<string, PeriodAccumulator>;
  tseSequence: string | null;
  electionNumber: string | null;
  electionStatus: string | null;
  assetsTotal: number | null;
  assetsCount: number | null;
  birthDate: string | null;
  birthPlace: string | null;
  education: string | null;
  office: string | null;
  staff: Array<{ name: string; role: string; startDate: string | null }>;
  assets: Array<{ type: string; description: string; value: number }>;
  totalVotes: number | null;
  totalCampaignReceipts: number | null;
  totalPublicReceipts: number | null;
  totalCampaignExpenses: number | null;
  topDonors: Array<{ name: string; value: number }>;
  topSuppliers: Array<{ name: string; value: number }>;
};

export type CsvRow = Record<string, string>;

export const substantiveTypes = new Set(["PL", "PLP", "PEC", "PDL", "PRC"]);
export const oversightTypes = new Set(["RIC", "PFC"]);
export const reqTypes = new Set(["REQ"]);
export const symbolicTypes = new Set(["MSC", "INC"]);

export const ALL_PROPOSAL_TYPES = new Set([...substantiveTypes, ...oversightTypes, ...reqTypes, ...symbolicTypes]);

export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
}

export function slugify(value: string, id: number) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base}-${id}`;
}

export function numberFrom(value: string | undefined) {
  if (!value) return 0;
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function dateOnly(value: string | undefined) {
  return value?.slice(0, 10) || null;
}

export function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function timestamp(value: string) {
  return new Date(`${value}T00:00:00Z`).getTime();
}

export function daysInclusive(start: string, end: string) {
  return Math.max(1, Math.floor((timestamp(end) - timestamp(start)) / 86_400_000) + 1);
}

export function dayBefore(value: string) {
  return new Date(timestamp(value) - 86_400_000).toISOString().slice(0, 10);
}

export function periodDefinitions() {
  return [
    ...YEARS.map((year) => ({
      id: String(year),
      label: String(year),
      start: year === 2023 ? PERIOD_START : `${year}-01-01`,
      end: year === CURRENT_YEAR ? PERIOD_END : `${year}-12-31`,
      partial: year === CURRENT_YEAR && PERIOD_END !== `${year}-12-31`,
    })),
    {
      id: "legislature",
      label: "Legislatura completa",
      start: PERIOD_START,
      end: PERIOD_END,
      partial: true,
    },
  ];
}

export const PERIODS = periodDefinitions();

export function emptyPeriod(): PeriodAccumulator {
  return {
    daysInOffice: 0,
    officeStart: PERIOD_END,
    officeEnd: PERIOD_START,
    partyDays: new Map(),
    stateDays: new Map(),
    plenaryAttendances: new Set(),
    plenarySessionsTotal: new Set(),
    nominalVotes: new Set(),
    nominalVotesTotal: new Set(),
    substantiveProposals: new Set(),
    oversightProposals: new Set(),
    advancedProposals: new Set(),
    convertedProposals: new Set(),
    authorProposals: new Set(),
    coauthorProposals: new Set(),
    requesterProposals: new Set(),
    fiscalizationProposals: new Set(),
    expensesTotal: 0,
    expenseDocuments: 0,
    suppliers: new Map(),
    expenseCategories: new Map(),
    largestExpenses: [],
    proposals: new Map(),
    amendments: [],
    publicVotes: [],
    allPublicVotes: [],
  };
}

export function periodIdsForDate(date: string | null) {
  if (!date || date < PERIOD_START || date > PERIOD_END) return [];
  return [date.slice(0, 4), "legislature"];
}

export async function fetchJson<T>(url: string, attempt = 0): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (attempt < 6) {
      await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
      return fetchJson<T>(url, attempt + 1);
    }
    throw error;
  }
  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
    const delay = Math.max(retryAfter, 750 * 2 ** attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchJson<T>(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status} ao consultar ${url}`);
  return response.json() as Promise<T>;
}

export async function fetchBuffer(url: string) {
  return cachedDownload(url, "bin", 60_000);
}

export async function forEachRemoteCsv(
  url: string,
  onRow: (row: CsvRow) => void,
  attempt = 0,
) {
  console.log(`Lendo ${url}`);
  try {
    const buffer = await cachedDownload(url, "csv", 300_000);
    await forEachBufferCsv(buffer, "utf8", onRow);
  } catch (error) {
    if (attempt < 4) {
      const delay = 1_000 * 2 ** attempt;
      console.warn(`Falha ao ler ${url}; tentando novamente em ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return forEachRemoteCsv(url, onRow, attempt + 1);
    }
    throw error;
  }
}

export async function forEachBufferCsv(
  buffer: Buffer,
  encoding: "utf8" | "latin1",
  onRow: (row: CsvRow) => void,
) {
  const parser = Readable.from(buffer).pipe(
    parse({
      bom: true,
      columns: true,
      delimiter: ";",
      relax_quotes: true,
      relax_column_count: true,
      encoding,
    }),
  );
  for await (const row of parser) onRow(row as CsvRow);
}

export async function mapLimit<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
) {
  const result: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(values[index]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return result;
}

export function buildIntervals(statuses: DeputyStatus[]) {
  const sorted = [...statuses].sort((a, b) =>
    a.dataHora.localeCompare(b.dataHora),
  );
  const intervals: ExerciseInterval[] = [];
  let active: { start: string; party: string; state: string } | null = null;

  for (const status of sorted) {
    const date = dateOnly(status.dataHora);
    if (!date) continue;
    if (status.situacao === "Exercício") {
      if (
        active &&
        active.party === status.siglaPartido &&
        active.state === status.siglaUf
      ) {
        continue;
      }
      if (active) {
        intervals.push({
          ...active,
          end: dayBefore(date),
        });
      }
      active = {
        start: date < PERIOD_START ? PERIOD_START : date,
        party: status.siglaPartido,
        state: status.siglaUf,
      };
    } else if (active) {
      intervals.push({
        ...active,
        end: date > PERIOD_END ? PERIOD_END : dayBefore(date),
      });
      active = null;
    }
  }
  if (active) intervals.push({ ...active, end: PERIOD_END });
  return intervals.filter(
    (interval) =>
      interval.start <= interval.end &&
      interval.end >= PERIOD_START &&
      interval.start <= PERIOD_END,
  );
}

export function addExercisePeriods(accumulator: DeputyAccumulator) {
  for (const period of PERIODS) {
    const target = emptyPeriod();
    for (const interval of accumulator.intervals) {
      const start = interval.start > period.start ? interval.start : period.start;
      const end = interval.end < period.end ? interval.end : period.end;
      if (start > end) continue;
      const days = daysInclusive(start, end);
      target.daysInOffice += days;
      target.officeStart = start < target.officeStart ? start : target.officeStart;
      target.officeEnd = end > target.officeEnd ? end : target.officeEnd;
      target.partyDays.set(
        interval.party,
        (target.partyDays.get(interval.party) || 0) + days,
      );
      target.stateDays.set(
        interval.state,
        (target.stateDays.get(interval.state) || 0) + days,
      );
    }
    if (target.daysInOffice > 0) accumulator.periods.set(period.id, target);
  }
}

export async function loadLegislatureDeputies() {
  const deputies: ChamberDeputy[] = [];
  for (let page = 1; ; page += 1) {
    const response = await fetchJson<{
      dados: ChamberDeputy[];
      links: Array<{ rel: string }>;
    }>(
      `${CHAMBER_API}/deputados?idLegislatura=${LEGISLATURE}&itens=100&pagina=${page}&ordem=ASC&ordenarPor=nome`,
    );
    deputies.push(...response.dados);
    if (!response.links.some((link) => link.rel === "next")) break;
  }

  const unique = Array.from(
    new Map(deputies.map((deputy) => [deputy.id, deputy])).values(),
  );
  console.log(`Carregando histórico de ${unique.length} parlamentares`);
  let loadedDetails = 0;
  const details = await mapLimit(unique, 8, async (deputy) => {
    try {
      const [detail, history] = await Promise.all([
        fetchJson<{
          dados: {
            nomeCivil: string;
            dataNascimento: string | null;
            municipioNascimento: string | null;
            ufNascimento: string | null;
            escolaridade: string | null;
            ultimoStatus: {
              gabinete: {
                nome: string | null;
                predio: string | null;
                sala: string | null;
              };
            };
          };
        }>(
          `${CHAMBER_API}/deputados/${deputy.id}`,
        ),
        fetchJson<{ dados: DeputyStatus[] }>(
          `${CHAMBER_API}/deputados/${deputy.id}/historico`,
        ),
      ]);
      loadedDetails += 1;
      if (loadedDetails % 25 === 0 || loadedDetails === unique.length) {
        console.log(`Históricos carregados: ${loadedDetails}/${unique.length}`);
      }
      return {
        deputy,
        civilName: detail.dados.nomeCivil,
        intervals: buildIntervals(history.dados),
        birthDate: detail.dados.dataNascimento,
        birthPlace: [detail.dados.municipioNascimento, detail.dados.ufNascimento]
          .filter(Boolean)
          .join("/") || null,
        education: detail.dados.escolaridade,
        office: detail.dados.ultimoStatus.gabinete.nome
          ? `Gabinete ${detail.dados.ultimoStatus.gabinete.nome}, prédio ${detail.dados.ultimoStatus.gabinete.predio || "N/D"}`
          : null,
      };
    } catch (error) {
      loadedDetails += 1;
      console.warn(`Erro ao carregar deputado ${deputy.id} (${deputy.nome}): ${error}`);
      return null;
    }
  });

  return new Map(
    details.filter((d): d is NonNullable<typeof d> => d !== null).map(
      ({
        deputy,
        civilName,
        intervals,
        birthDate,
        birthPlace,
        education,
        office,
      }) => {
      const accumulator: DeputyAccumulator = {
        deputy,
        civilName,
        intervals,
        periods: new Map(),
        tseSequence: null,
        electionNumber: null,
        electionStatus: null,
        assetsTotal: null,
        assetsCount: null,
        birthDate,
        birthPlace,
        education,
        office,
        staff: [],
        assets: [],
        totalVotes: null,
        totalCampaignReceipts: null,
        totalPublicReceipts: null,
        totalCampaignExpenses: null,
        topDonors: [],
        topSuppliers: [],
      };
      addExercisePeriods(accumulator);
      return [deputy.id, accumulator];
      },
    ),
  );
}

export function forDatePeriods(
  accumulator: DeputyAccumulator,
  date: string | null,
  callback: (period: PeriodAccumulator) => void,
) {
  for (const periodId of periodIdsForDate(date)) {
    const period = accumulator.periods.get(periodId);
    if (period) callback(period);
  }
}

export function isInExerciseOnDate(accumulator: DeputyAccumulator, date: string | null) {
  if (!date) return false;
  return accumulator.intervals.some(
    (interval) => interval.start <= date && interval.end >= date,
  );
}

export function forExerciseDatePeriods(
  accumulator: DeputyAccumulator,
  date: string | null,
  callback: (period: PeriodAccumulator) => void,
) {
  if (!isInExerciseOnDate(accumulator, date)) return;
  forDatePeriods(accumulator, date, callback);
}

export function addPublicVoteRecord(
  accumulator: DeputyAccumulator,
  vote: PublicVoteMetadata,
  candidateVote: CandidateVote,
) {
  if (!vote.analysis) return;
  const record = buildPublicVoteRecord(
    vote.analysis,
    accumulator.deputy.id,
    candidateVote,
  );
  forDatePeriods(accumulator, vote.date, (period) => {
    const profileRecord = {
      ...record,
      date: vote.date,
      description: truncateText(vote.description, 220),
      summary: truncateText(vote.summary, 350),
      source: vote.url,
      url: vote.url,
    };
    period.publicVotes.push(profileRecord);
    period.allPublicVotes.push(profileRecord);
  });
}

export function addUnanalyzedVoteRecord(
  accumulator: DeputyAccumulator,
  vote: PublicVoteMetadata,
  candidateVote: CandidateVote,
) {
  forDatePeriods(accumulator, vote.date, (period) => {
    period.allPublicVotes.push({
      voteId: vote.id,
      candidateId: String(accumulator.deputy.id),
      candidateVote,
      classification: "unanalyzed",
      severity: "",
      scoreDelta: 0,
      confidence: null,
      reason: "",
      source: "",
      reviewedManually: false,
      date: vote.date,
      description: truncateText(vote.description, 220),
      summary: truncateText(vote.summary, 350),
      url: vote.url,
    });
  });
}

function loadReviewedPublicVoteClassifications() {
  const fileUrl = new URL(
    "../../.data/public-vote-classifications.json",
    import.meta.url,
  );
  if (!existsSync(fileUrl)) {
    return new Map<string, PublicVoteAnalysis>();
  }

  const file = JSON.parse(readFileSync(fileUrl, "utf-8")) as {
    methodologyVersion?: string;
    classifications?: Record<string, ReviewedPublicVoteClassification>;
  };
  const classifications = new Map<string, PublicVoteAnalysis>();
  for (const [voteId, classification] of Object.entries(file.classifications ?? {})) {
    classifications.set(voteId, {
      voteId,
      classification: classification.classification,
      severity: classification.severity,
      publicInterestVote: classification.publicInterestVote,
      confidence: classification.confidence,
      reason: classification.reason,
      source: classification.source ?? "reviewed",
      analysisLevel: classification.analysisLevel ?? (classification.source === "rule" ? 1 : 2),
      reviewedManually: classification.reviewedManually ?? true,
      methodologyVersion: file.methodologyVersion ?? publicValueClassificationMetadata().methodologyVersion,
    });
  }
  return classifications;
}

export async function loadParticipation(accumulators: Map<number, DeputyAccumulator>) {
  for (const year of YEARS) {
    const eligibleEvents = new Map<string, string>();
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/eventos/csv/eventos-${year}.csv`,
      (row) => {
        const date = dateOnly(row.dataHoraInicio);
        if (
          row.situacao === "Encerrada" &&
          row.descricaoTipo === "Sessão Deliberativa" &&
          date &&
          date <= PERIOD_END
        ) {
          eligibleEvents.set(row.id, date);
        }
      },
    );
    for (const [eventId, eventDate] of eligibleEvents) {
      for (const accumulator of accumulators.values()) {
        forExerciseDatePeriods(accumulator, eventDate, (period) => {
          period.plenarySessionsTotal.add(eventId);
        });
      }
    }
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/eventosPresencaDeputados/csv/eventosPresencaDeputados-${year}.csv`,
      (row) => {
        if (!eligibleEvents.has(row.idEvento)) return;
        const accumulator = accumulators.get(Number(row.idDeputado));
        if (!accumulator) return;
        forDatePeriods(accumulator, dateOnly(row.dataHoraInicio), (period) => {
          period.plenaryAttendances.add(row.idEvento);
        });
      },
    );
    const eligibleNominalVotes = new Map<string, string>();
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/votacoesVotos/csv/votacoesVotos-${year}.csv`,
      (row) => {
        const voteDate = dateOnly(row.dataHoraVoto);
        if (row.idVotacao && voteDate && voteDate <= PERIOD_END) {
          eligibleNominalVotes.set(row.idVotacao, voteDate);
        }
        const accumulator = accumulators.get(Number(row.deputado_id));
        if (!accumulator) return;
        forDatePeriods(accumulator, voteDate, (period) => {
          period.nominalVotes.add(row.idVotacao);
        });
      },
    );
    for (const [voteId, voteDate] of eligibleNominalVotes) {
      for (const accumulator of accumulators.values()) {
        forExerciseDatePeriods(accumulator, voteDate, (period) => {
          period.nominalVotesTotal.add(voteId);
        });
      }
    }
  }
}

export async function loadPublicVotes(accumulators: Map<number, DeputyAccumulator>) {
  const votes = new Map<string, PublicVoteMetadata>();
  const reviewedPublicVoteClassifications = loadReviewedPublicVoteClassifications();
  for (const year of YEARS) {
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/votacoes/csv/votacoes-${year}.csv`,
      (row) => {
        const date = dateOnly(row.data || row.dataHoraRegistro);
        if (!row.id || !date || date > PERIOD_END) return;
        votes.set(row.id, {
          id: row.id,
          date,
          description:
            row.descricao ||
            row.ultimaAberturaVotacao_descricao ||
            row.ultimaApresentacaoProposicao_descricao ||
            "Descrição não informada",
          summary: "",
          url: row.uri || `${CHAMBER_API}/votacoes/${row.id}`,
          analysis: null,
        });
      },
    );
  }

  const summaries = new Map<string, Set<string>>();
  for (const year of YEARS) {
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/votacoesObjetos/csv/votacoesObjetos-${year}.csv`,
      (row) => {
        const vote = votes.get(row.idVotacao);
        if (!vote) return;
        const bucket = summaries.get(row.idVotacao) || new Set<string>();
        for (const value of [
          row.descricao,
          row.proposicao_ementa,
          row.proposicao_titulo,
        ]) {
          if (value) bucket.add(value);
        }
        summaries.set(row.idVotacao, bucket);
      },
    );
  }

  for (const vote of votes.values()) {
    vote.summary = [...(summaries.get(vote.id) || [])].join(" ");
    vote.analysis = reviewedPublicVoteClassifications.get(vote.id) ?? null;
  }

  const castByVote = new Map<string, Set<number>>();
  for (const year of YEARS) {
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/votacoesVotos/csv/votacoesVotos-${year}.csv`,
      (row) => {
        const vote = votes.get(row.idVotacao);
        if (!vote) return;
        const accumulator = accumulators.get(Number(row.deputado_id));
        if (!accumulator) return;
        const candidateVote = normalizePublicVote(row.voto);
        if (!vote.analysis) {
          addUnanalyzedVoteRecord(accumulator, vote, candidateVote);
          return;
        }
        addPublicVoteRecord(accumulator, vote, candidateVote);
        if (
          vote.analysis.severity === "high" ||
          vote.analysis.severity === "critical"
        ) {
          const cast = castByVote.get(vote.id) || new Set<number>();
          cast.add(accumulator.deputy.id);
          castByVote.set(vote.id, cast);
        }
      },
    );
  }

  for (const vote of votes.values()) {
    if (
      !vote.analysis ||
      (vote.analysis.severity !== "high" && vote.analysis.severity !== "critical")
    ) {
      continue;
    }
    const cast = castByVote.get(vote.id) || new Set<number>();
    for (const accumulator of accumulators.values()) {
      if (cast.has(accumulator.deputy.id)) continue;
      if (periodIdsForDate(vote.date).some((periodId) => accumulator.periods.has(periodId))) {
        addPublicVoteRecord(accumulator, vote, "absent");
      }
    }
  }

  return votes;
}

export function determineRole(
  proposalType: string,
  proponente: string,
): "AUTHOR" | "COAUTHOR" | "REQUESTER" | "FISCALIZATION" {
  if (oversightTypes.has(proposalType)) {
    return proponente === "1" ? "REQUESTER" : "FISCALIZATION";
  }
  if (proponente === "1") return "AUTHOR";
  return "COAUTHOR";
}

export function determineNature(proposalType: string, summary: string): string {
  if (substantiveTypes.has(proposalType)) return "SUBSTANTIVE";
  if (oversightTypes.has(proposalType)) return "FISCALIZATION";
  if (symbolicTypes.has(proposalType)) return "SYMBOLIC";
  if (reqTypes.has(proposalType)) {
    const text = normalizeProposalText(summary);
    if (/informacao|convocacao|audiencia|fiscalizacao|controle/.test(text)) return "FISCALIZATION";
    if (/urgencia|pauta|adiamento|preferencia|destaque|recurso/.test(text)) return "PROCEDURAL";
    return "UNKNOWN";
  }
  return "UNKNOWN";
}

export async function loadProduction(accumulators: Map<number, DeputyAccumulator>) {
  const proposals = new Map<
    string,
    {
      type: string;
      number: string;
      year: string;
      date: string | null;
      summary: string;
      status: string;
      url: string;
    }
  >();
  for (const year of YEARS) {
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/proposicoes/csv/proposicoes-${year}.csv`,
      (row) => {
        if (ALL_PROPOSAL_TYPES.has(row.siglaTipo)) {
          proposals.set(row.id, {
            type: row.siglaTipo,
            number: row.numero,
            year: row.ano,
            date: dateOnly(row.dataApresentacao),
            summary: row.ementa || "Ementa não informada",
            status:
              row.ultimoStatus_descricaoSituacao ||
              row.ultimoStatus_descricaoTramitacao ||
              "Situação não informada",
            url: `https://www.camara.leg.br/propostas-legislativas/${row.id}`,
          });
        }
      },
    );
  }

  const authors = new Map<string, number>();
  const proposalAuthors = new Map<string, Set<number>>();
  for (const year of YEARS) {
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/proposicoesAutores/csv/proposicoesAutores-${year}.csv`,
      (row) => {
        if (!proposals.has(row.idProposicao)) return;
        const deputyId = Number(row.idDeputadoAutor);
        const accumulator = accumulators.get(deputyId);
        const proposal = proposals.get(row.idProposicao);
        if (!accumulator || !proposal) return;
        if (!authors.has(row.idProposicao)) {
          authors.set(row.idProposicao, deputyId);
        }
        const deputies = proposalAuthors.get(row.idProposicao);
        if (deputies) {
          deputies.add(deputyId);
        } else {
          proposalAuthors.set(row.idProposicao, new Set([deputyId]));
        }
        const role = determineRole(proposal.type, row.proponente);
        const nature = determineNature(proposal.type, proposal.summary);
        const roleLabel =
          role === "AUTHOR" ? "Autoria principal" :
          role === "COAUTHOR" ? "Coautoria" :
          role === "REQUESTER" ? "Requerente" :
          role === "FISCALIZATION" ? "Fiscalização" : "Não identificado";
        const natureLabel =
          nature === "SUBSTANTIVE" ? "Proposta substantiva" :
          nature === "FISCALIZATION" ? "Fiscalização" :
          nature === "PROCEDURAL" ? "Procedimental" :
          nature === "SYMBOLIC" ? "Simbólica" : "Não classificada";
        forDatePeriods(accumulator, proposal.date, (period) => {
          if (substantiveTypes.has(proposal.type)) {
            period.substantiveProposals.add(row.idProposicao);
          } else if (oversightTypes.has(proposal.type)) {
            period.oversightProposals.add(row.idProposicao);
          }
          if (role === "AUTHOR") period.authorProposals.add(row.idProposicao);
          if (role === "COAUTHOR") period.coauthorProposals.add(row.idProposicao);
          if (role === "REQUESTER") period.requesterProposals.add(row.idProposicao);
          if (role === "FISCALIZATION") period.fiscalizationProposals.add(row.idProposicao);
          period.proposals.set(row.idProposicao, {
            id: row.idProposicao,
            type: proposal.type,
            number: proposal.number,
            year: proposal.year,
            date: proposal.date || `${proposal.year}-01-01`,
            summary: proposal.summary,
            status: proposal.status,
            url: proposal.url,
            participationRole: role,
            participationLabel: roleLabel,
            proposalNature: nature,
            proposalNatureLabel: natureLabel,
          });
        });
      },
    );
  }

  for (const year of YEARS) {
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/proposicoesTramitacoes/csv/proposicoesTramitacoes-${year}.csv`,
      (row) => {
        const proposalId = row.uriProposicao?.split("/").pop() || "";
        const deputyIds = proposalAuthors.get(proposalId);
        if (!deputyIds) return;
        const text = `${row.descricaoTramitacao || ""} ${row.despacho || ""}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase("pt-BR");
        for (const deputyId of deputyIds) {
          const accumulator = accumulators.get(deputyId);
          if (!accumulator) continue;
          forDatePeriods(accumulator, dateOnly(row.dataHora), (period) => {
            period.advancedProposals.add(proposalId);
            const stored = period.proposals.get(proposalId);
            if (stored) {
              stored.status =
                row.descricaoTramitacao || row.despacho || stored.status;
            }
            if (/transformad|convertid/.test(text) && /norma|lei/.test(text)) {
              period.convertedProposals.add(proposalId);
            }
          });
        }
      },
    );
  }
}

export async function loadExpenses(accumulators: Map<number, DeputyAccumulator>) {
  for (const year of YEARS) {
    const url = `https://www.camara.leg.br/cotas/Ano-${year}.csv.zip`;
    console.log(`Lendo ${url}`);
    const zip = new AdmZip(await fetchBuffer(url));
    const entry = zip.getEntries().find((candidate) => candidate.entryName.endsWith(".csv"));
    if (!entry) throw new Error(`CSV não encontrado em ${url}`);
    await forEachBufferCsv(entry.getData(), "utf8", (row) => {
      const accumulator = accumulators.get(Number(row.ideCadastro));
      const date = dateOnly(row.datEmissao);
      const amount = numberFrom(row.vlrLiquido);
      if (!accumulator || !date || amount <= 0) return;
      const supplierKey = normalize(
        row.txtCNPJCPF || row.txtFornecedor || "NAO INFORMADO",
      );
      const supplierName = row.txtFornecedor || "Fornecedor não informado";
      const taxId = row.txtCNPJCPF || null;
      const category = row.txtDescricao || "Categoria não informada";
      forDatePeriods(accumulator, date, (period) => {
        period.expensesTotal += amount;
        period.expenseDocuments += 1;
        const supplier = period.suppliers.get(supplierKey) || {
          name: supplierName,
          taxId,
          total: 0,
          documents: 0,
        };
        supplier.total += amount;
        supplier.documents += 1;
        period.suppliers.set(supplierKey, supplier);
        const categoryTotal = period.expenseCategories.get(category) || {
          total: 0,
          documents: 0,
        };
        categoryTotal.total += amount;
        categoryTotal.documents += 1;
        period.expenseCategories.set(category, categoryTotal);
        period.largestExpenses.push({
          category,
          supplier: supplierName,
          date,
          value: amount,
          documentUrl: row.urlDocumento || null,
        });
        period.largestExpenses.sort((a, b) => b.value - a.value);
        if (period.largestExpenses.length > 10) period.largestExpenses.length = 10;
    });
  });
}
}

export async function loadTse(accumulators: Map<number, DeputyAccumulator>) {
  const byCivilNameAndState = new Map<string, DeputyAccumulator[]>();
  for (const accumulator of accumulators.values()) {
    const state =
      accumulator.intervals[0]?.state || accumulator.deputy.siglaUf;
    const key = `${normalize(accumulator.civilName)}:${state}`;
    byCivilNameAndState.set(key, [
      ...(byCivilNameAndState.get(key) || []),
      accumulator,
    ]);
  }

  const candidateZipPath = await cachedDownloadPath(
    `${TSE_FILES}/consulta_cand/consulta_cand_2022.zip`,
    "zip",
    600_000,
  );
  await forEachZipCsvEntry(
    candidateZipPath,
    (name) => name === "consulta_cand_2022_BRASIL.csv",
    "latin1",
    (row) => {
    if (row.DS_CARGO !== "DEPUTADO FEDERAL") return;
    const matches = byCivilNameAndState.get(
      `${normalize(row.NM_CANDIDATO)}:${row.SG_UF}`,
    );
    if (!matches || matches.length !== 1) return;
    const accumulator = matches[0];
    accumulator.tseSequence = row.SQ_CANDIDATO;
    accumulator.electionNumber = row.NR_CANDIDATO;
    accumulator.electionStatus = row.DS_SITUACAO_CANDIDATURA;
  });

  const bySequence = new Map<string, DeputyAccumulator>();
  for (const accumulator of accumulators.values()) {
    if (accumulator.tseSequence) bySequence.set(accumulator.tseSequence, accumulator);
  }
  const assetsZipPath = await cachedDownloadPath(
    `${TSE_FILES}/bem_candidato/bem_candidato_2022.zip`,
    "zip",
    600_000,
  );
  await forEachZipCsvEntry(
    assetsZipPath,
    (name) => name === "bem_candidato_2022_BRASIL.csv",
    "latin1",
    (row) => {
    const accumulator = bySequence.get(row.SQ_CANDIDATO);
    if (!accumulator) return;
    const value = numberFrom(row.VR_BEM_CANDIDATO);
    accumulator.assetsTotal =
      (accumulator.assetsTotal || 0) + value;
    accumulator.assetsCount = (accumulator.assetsCount || 0) + 1;
    accumulator.assets.push({
      type: row.DS_TIPO_BEM_CANDIDATO || "Bem declarado",
      description: row.DS_BEM_CANDIDATO || "Descrição não informada",
      value,
    });
  });
}

export async function loadVotes(accumulators: Map<number, DeputyAccumulator>) {
  const bySequence = new Map<string, DeputyAccumulator>();
  for (const accumulator of accumulators.values()) {
    if (accumulator.tseSequence) bySequence.set(accumulator.tseSequence, accumulator);
  }
  if (bySequence.size === 0) return;

  const zipPath = await cachedDownloadPath(
    "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip",
    "zip",
    600_000,
  );

  await forEachZipCsvEntry(
    zipPath,
    (name) => name.endsWith(".csv"),
    "latin1",
    (row) => {
      const accumulator = bySequence.get(row.SQ_CANDIDATO);
      if (!accumulator) return;
      const votes = numberFrom(row.QT_VOTOS_NOMINAIS);
      if (votes !== null) {
        accumulator.totalVotes = (accumulator.totalVotes || 0) + votes;
      }
    },
  );
}

export async function loadCampaignFinanceData(accumulators: Map<number, DeputyAccumulator>) {
  const bySequence = new Map<string, DeputyAccumulator>();
  for (const accumulator of accumulators.values()) {
    if (accumulator.tseSequence) bySequence.set(accumulator.tseSequence, accumulator);
  }
  if (bySequence.size === 0) return;

  const zipPath = await cachedDownloadPath(
    `${TSE_FILES}/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2022.zip`,
    "zip",
    600_000,
  );

  const providerToCandidate = new Map<string, string>();
  const donorTotals = new Map<string, Map<string, number>>();
  const seenCandidates = new Set<string>();

  await forEachZipCsvEntry(
    zipPath,
    (name) => name === "receitas_candidatos_2022_BRASIL.csv",
    "latin1",
    (row) => {
      if (row.SQ_PRESTADOR_CONTAS) {
        providerToCandidate.set(row.SQ_PRESTADOR_CONTAS, row.SQ_CANDIDATO);
      }
      const accumulator = bySequence.get(row.SQ_CANDIDATO);
      if (!accumulator) return;
      seenCandidates.add(row.SQ_CANDIDATO);
      const value = numberFrom(row.VR_RECEITA);
      if (value === null || value <= 0) return;

      accumulator.totalCampaignReceipts = (accumulator.totalCampaignReceipts || 0) + value;

      const origin = (row.DS_ORIGEM_RECEITA || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      if (origin.includes("FEFC") || origin.includes("FUNDO ESPECIAL") || origin.includes("FUNDO PARTIDARIO") || origin.includes("RECURSO DE ORIGEM PUBLICA") || origin.includes("Fundo Partidario") || origin.includes("RECURSOS DE ORIGEM PUBLICA")) {
        accumulator.totalPublicReceipts = (accumulator.totalPublicReceipts || 0) + value;
      }

      const donorName = row.NM_DOADOR_RFB || row.NM_DOADOR || row.DS_ORIGEM_RECEITA || "Doador não informado";
      const id = accumulator.deputy.id.toString();
      if (!donorTotals.has(id)) donorTotals.set(id, new Map());
      const candidateDonors = donorTotals.get(id)!;
      candidateDonors.set(donorName, (candidateDonors.get(donorName) || 0) + value);
    },
  );

  const supplierTotals = new Map<string, Map<string, number>>();

  await forEachZipCsvEntry(
    zipPath,
    (name) => name === "despesas_pagas_candidatos_2022_BRASIL.csv",
    "latin1",
    (row) => {
    const candidateId = providerToCandidate.get(row.SQ_PRESTADOR_CONTAS);
    if (!candidateId) return;
    const accumulator = bySequence.get(candidateId);
    if (!accumulator) return;
    const value = numberFrom(row.VR_PAGTO_DESPESA);
    if (value === null || value <= 0) return;

    accumulator.totalCampaignExpenses = (accumulator.totalCampaignExpenses || 0) + value;

    const supplierName = row.NM_FORNECEDOR_RFB || row.NM_FORNECEDOR || row.DS_FORNECEDOR || "Fornecedor não informado";
    const id = accumulator.deputy.id.toString();
    if (!supplierTotals.has(id)) supplierTotals.set(id, new Map());
    const candidateSuppliers = supplierTotals.get(id)!;
    candidateSuppliers.set(supplierName, (candidateSuppliers.get(supplierName) || 0) + value);
  });

  for (const accumulator of accumulators.values()) {
    const id = accumulator.deputy.id.toString();
    const donors = donorTotals.get(id);
    if (donors) {
      accumulator.topDonors = [...donors.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 50);
    }
    const suppliers = supplierTotals.get(id);
    if (suppliers) {
      accumulator.topSuppliers = [...suppliers.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 50);
    }
  }
}

export async function loadStaff(accumulators: Map<number, DeputyAccumulator>) {
  await forEachRemoteCsv(
    `${CHAMBER_FILES}/funcionarios/csv/funcionarios.csv`,
    (row) => {
      if (row.codGrupo !== "6") return;
      const deputyId = Number(row.uriLotacao?.split("/").pop());
      const accumulator = accumulators.get(deputyId);
      if (!accumulator) return;
      accumulator.staff.push({
        name: row.nome,
        role: row.cargo || "Secretário parlamentar",
        startDate: dateOnly(row.dataInicioHistorico || row.dataNomeacao),
      });
    },
  );
}

export async function loadAmendments(accumulators: Map<number, DeputyAccumulator>) {
  const byName = new Map<string, DeputyAccumulator[]>();
  for (const accumulator of accumulators.values()) {
    for (const name of [accumulator.civilName, accumulator.deputy.nome]) {
      const key = normalize(name);
      const matches = byName.get(key) || [];
      if (!matches.includes(accumulator)) matches.push(accumulator);
      byName.set(key, matches);
    }
  }
  const zip = new AdmZip(
    await fetchBuffer(
      "https://repositorio.dados.gov.br/seges/detru/siconv_emenda.csv.zip",
    ),
  );
  const entry = zip.getEntries().find((candidate) =>
    candidate.entryName.endsWith(".csv"),
  );
  if (!entry) throw new Error("CSV de emendas do Transferegov não encontrado");
  await forEachBufferCsv(entry.getData(), "utf8", (row) => {
    const matches = byName.get(normalize(row.NOME_PARLAMENTAR || ""));
    if (!matches || matches.length !== 1) return;
    const year = row.COD_PROGRAMA_EMENDA?.match(/20\d{2}/)?.[0];
    if (!year || !YEARS.includes(Number(year))) return;
    const amendment = {
      number: row.NR_EMENDA || "Número não informado",
      year,
      type: row.TIPO_PARLAMENTAR || "Tipo não informado",
      beneficiary: row.BENEFICIARIO_EMENDA || "Beneficiário não informado",
      proposedValue: numberFrom(row.VALOR_REPASSE_PROPOSTA_EMENDA),
      transferredValue: numberFrom(row.VALOR_REPASSE_EMENDA),
    };
    for (const periodId of [year, "legislature"]) {
      const period = matches[0].periods.get(periodId);
      if (period) period.amendments.push(amendment);
    }
  });
}

export function dominantValue(values: Map<string, number>, fallback: string) {
  return (
    [...values.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || fallback
  );
}

export function buildPeriodDeputy(
  item: DeputyAccumulator,
  period: PeriodAccumulator,
): PeriodDeputyRecord {
  const expensesTotal =
    period.expenseDocuments > 0 ? period.expensesTotal : null;
  const supplierConcentration =
    expensesTotal && expensesTotal > 0
      ? [...period.suppliers.values()].reduce(
          (sum, supplier) => sum + (supplier.total / expensesTotal) ** 2,
          0,
        )
      : null;
  const metrics: RawMetrics = {
    monthsInOffice: Number((period.daysInOffice / 30.4375).toFixed(2)),
    plenaryAttendances: period.plenaryAttendances.size,
    plenarySessionsTotal: period.plenarySessionsTotal.size,
    nominalVotes: period.nominalVotes.size,
    nominalVotesTotal: period.nominalVotesTotal.size,
    substantiveProposals: period.substantiveProposals.size,
    oversightProposals: period.oversightProposals.size,
    advancedProposals: period.advancedProposals.size,
    convertedProposals: period.convertedProposals.size,
    authorProposals: period.authorProposals.size,
    coauthorProposals: period.coauthorProposals.size,
    requesterProposals: period.requesterProposals.size,
    fiscalizationProposals: period.fiscalizationProposals.size,
    expensesTotal,
    expenseDocuments: period.expenseDocuments || null,
    supplierConcentration,
    campaignCandidacyAvailable: Boolean(item.tseSequence),
    assetsAvailable: item.assetsCount !== null,
    totalVotes: item.totalVotes,
    totalCampaignReceipts: item.totalCampaignReceipts,
    totalPublicReceipts: item.totalPublicReceipts,
    totalCampaignExpenses: item.totalCampaignExpenses,
    topDonors: item.topDonors,
    topSuppliers: item.topSuppliers,
    ...publicValueMetrics(period),
    ...publicVoteMetrics(period),
  };
  return {
    id: item.deputy.id,
    party: dominantValue(period.partyDays, item.deputy.siglaPartido),
    state: dominantValue(period.stateDays, item.deputy.siglaUf),
    officeStart: period.officeStart,
    officeEnd: period.officeEnd,
    daysInOffice: period.daysInOffice,
    metrics,
  };
}

export function proposalStage(period: PeriodAccumulator, proposalId: string): ProposalStage {
  if (period.convertedProposals.has(proposalId)) return "converted";
  if (period.advancedProposals.has(proposalId)) return "advanced";
  return "presented";
}

export function publicValueMetrics(period: PeriodAccumulator) {
  let points = 0;
  let classified = 0;
  for (const proposal of period.proposals.values()) {
    const classification = classifyProposal(proposal.id, proposal.summary);
    if (!classification) continue;
    classified += 1;
    const stage = proposalStage(period, proposal.id);
    points += getProposalWeight({
      categoryWeight: PUBLIC_VALUE_CATEGORIES[classification.category].weight,
      stageMultiplier: proposalStageMultiplier(stage),
      role: proposal.participationRole as ParticipationRole,
      nature: proposal.proposalNature as ProposalNature,
      stage,
    });
  }
  return {
    publicContributionPoints: classified > 0 ? Number(points.toFixed(2)) : null,
    publicClassifiedProposals: classified,
    publicTotalProposals: period.proposals.size,
  };
}

export function publicVoteMetrics(period: PeriodAccumulator) {
  let positive = 0;
  let votePenalties = 0;
  let absencePenalties = 0;
  let confidence = 0;

  for (const vote of period.publicVotes) {
    if (vote.scoreDelta > 0) {
      positive += vote.scoreDelta;
    } else if (vote.scoreDelta < 0 && vote.candidateVote === "absent") {
      absencePenalties += Math.abs(vote.scoreDelta);
    } else if (vote.scoreDelta < 0) {
      votePenalties += Math.abs(vote.scoreDelta);
    }
    confidence += vote.confidence;
  }

  const analyzed = period.publicVotes.length;
  const score = positive - votePenalties - absencePenalties;
  return {
    publicVotePositivePoints: Number(positive.toFixed(2)),
    publicVoteNegativePenalties: Number(votePenalties.toFixed(2)),
    publicVoteAbsencePenalties: Number(absencePenalties.toFixed(2)),
    publicVotesAnalyzed: analyzed,
    publicVoteAverageConfidence:
      analyzed > 0 ? Number((confidence / analyzed).toFixed(3)) : null,
    publicVoteScore: analyzed > 0 ? Number(score.toFixed(2)) : null,
  };
}

export function buildProfilePeriod(
  item: DeputyAccumulator,
  period: PeriodAccumulator,
): ProfilePeriodDetails {
  return {
    id: item.deputy.id,
    expenseCategories: [...period.expenseCategories.entries()]
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    suppliers: [...period.suppliers.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    largestExpenses: [...period.largestExpenses],
    proposals: [...period.proposals.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((proposal) => {
        const classification = classifyProposal(proposal.id, proposal.summary);
        if (!classification) return { ...proposal, publicValue: null };
        const stage = proposalStage(period, proposal.id);
        const category = PUBLIC_VALUE_CATEGORIES[classification.category];
        const stageMultiplier = proposalStageMultiplier(stage);
        const role = proposal.participationRole as ParticipationRole;
        const nature = proposal.proposalNature as ProposalNature;
        const weight = getProposalWeight({
          categoryWeight: category.weight,
          stageMultiplier,
          role,
          nature,
          stage,
        });
        return {
          ...proposal,
          publicValue: {
            category: classification.category,
            categoryLabel: category.label,
            categoryWeight: category.weight,
            confidence: classification.confidence,
            justification: classification.justification,
            source: classification.source,
            stage,
            stageMultiplier,
            points: weight,
            methodologyVersion: classification.methodologyVersion,
            roleWeight: ROLE_WEIGHTS[role],
            natureWeight: NATURE_WEIGHTS[nature],
            progressBonus:
              stage === "converted"
                ? PROGRESS_BONUS.BECAME_NORM
                : stage === "advanced"
                  ? PROGRESS_BONUS.ADVANCED
                  : 0,
            scoreExplanation: `Papel: ${proposal.participationLabel} × ${proposal.proposalNatureLabel}`,
          },
        };
      })
      ,
    publicVotes: [...period.allPublicVotes]
      .sort(
        (a, b) =>
          Number(b.classification !== "unanalyzed") - Number(a.classification !== "unanalyzed") ||
          Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta) ||
          b.date.localeCompare(a.date),
      ),
    amendments: [...period.amendments]
      .sort(
        (a, b) =>
          b.transferredValue +
          b.proposedValue -
          (a.transferredValue + a.proposedValue),
      )
      .slice(0, 10),
  };
}

export function buildClassificationPending(
  accumulators: Map<number, DeputyAccumulator>,
) {
  const proposals = new Map<
    string,
    {
      id: string;
      type: string;
      number: string;
      year: string;
      summary: string;
      url: string;
    }
  >();
  for (const accumulator of accumulators.values()) {
    for (const period of accumulator.periods.values()) {
      for (const proposal of period.proposals.values()) {
        if (!classifyProposal(proposal.id, proposal.summary)) {
          proposals.set(proposal.id, proposal);
        }
      }
    }
  }
  const metadata = publicValueClassificationMetadata();
  return {
    generatedAt: new Date().toISOString(),
    methodologyVersion: metadata.methodologyVersion,
    total: proposals.size,
    proposals: [...proposals.values()].sort(
      (a, b) => Number(b.year) - Number(a.year) || a.id.localeCompare(b.id),
    ),
  };
}

export function buildPublicVoteClassificationPending(votes: Map<string, PublicVoteMetadata>) {
  const pending = [...votes.values()]
    .filter((vote) => !vote.analysis)
    .map(({ id, date, description, summary, url }) => ({
      id,
      date,
      description: truncateText(description, 300),
      summary: truncateText(summary, 700),
      url,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return {
    generatedAt: new Date().toISOString(),
    methodologyVersion: "2026-06-15-votes",
    total: pending.length,
    votes: pending,
  };
}

export function buildSnapshot(accumulators: Map<number, DeputyAccumulator>): RankingSnapshot {
  const deputies = [...accumulators.values()].map<DeputyIdentity>((item) => ({
    id: item.deputy.id,
    slug: slugify(item.deputy.nome, item.deputy.id),
    name: item.deputy.nome,
    civilName: item.civilName,
    photoUrl: item.deputy.urlFoto,
    chamberUrl: item.deputy.uri,
    electionNumber: item.electionNumber,
    tseSequence: item.tseSequence,
    electionStatus: item.electionStatus,
    assetsTotal: item.assetsTotal,
    assetsCount: item.assetsCount,
  }));

  const periods = PERIODS.map<RankingPeriod>((definition) => ({
    ...definition,
    deputies: [...accumulators.values()]
      .flatMap((item) => {
        const period = item.periods.get(definition.id);
        return period ? [buildPeriodDeputy(item, period)] : [];
      })
      .sort((a, b) => a.id - b.id),
  }));

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    timezone: "America/Fortaleza",
    defaultPeriod: String(CURRENT_YEAR),
    sources: [
      {
        name: "Dados Abertos da Câmara dos Deputados",
        url: "https://dadosabertos.camara.leg.br/",
        updatedAt: PERIOD_END,
      },
      {
        name: "Portal de Dados Abertos do TSE - Eleições 2022",
        url: "https://dadosabertos.tse.jus.br/dataset/candidatos-2022",
        updatedAt: PERIOD_END,
      },
    ],
    deputies: deputies.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    periods,
  };
}

export function buildProfileDetails(
  accumulators: Map<number, DeputyAccumulator>,
): ProfileDetailsSnapshot {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    deputies: [...accumulators.values()].map((item) => ({
      id: item.deputy.id,
      birthDate: item.birthDate,
      birthPlace: item.birthPlace,
      education: item.education,
      office: item.office,
      staff: item.staff.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      assets: item.assets.sort((a, b) => b.value - a.value),
    })),
    periods: PERIODS.filter((definition) => definition.id !== "legislature").map((definition) => ({
      id: definition.id,
      deputies: [...accumulators.values()].flatMap((item) => {
        const period = item.periods.get(definition.id);
        return period ? [buildProfilePeriod(item, period)] : [];
      }),
    })),
  };
}

export function computeCoverage(snapshot: RankingSnapshot) {
  const period = snapshot.periods.find((p) => p.id === snapshot.defaultPeriod);
  if (!period) return 0;
  const deputies = period.deputies;
  const total = deputies.length;
  if (total === 0) return 0;
  const categories = [
    (d: PeriodDeputyRecord) => d.metrics.plenaryAttendances !== null,
    (d: PeriodDeputyRecord) => d.metrics.nominalVotes !== null,
    (d: PeriodDeputyRecord) => d.metrics.substantiveProposals !== null,
    (d: PeriodDeputyRecord) => d.metrics.expensesTotal !== null,
    (d: PeriodDeputyRecord) => d.metrics.campaignCandidacyAvailable === true,
    (d: PeriodDeputyRecord) => d.metrics.assetsAvailable === true,
    (d: PeriodDeputyRecord) => (d.metrics.publicVotesAnalyzed ?? 0) > 0,
  ];
  const filled = categories.reduce(
    (sum, fn) => sum + deputies.filter(fn).length,
    0,
  );
  return Math.round((filled / (total * categories.length)) * 100);
}

export function buildBannerMetadata(
  snapshot: RankingSnapshot,
  classificationPending: { total: number },
) {
  const classificationFile: {
    classifications: Record<string, unknown>;
  } = JSON.parse(
    readFileSync(
      new URL("../../.data/public-value-classifications.json", import.meta.url),
      "utf-8",
    ),
  );
  const classified = Object.keys(classificationFile.classifications).length;
  const pending = classificationPending.total;
  const totalClassifiable = classified + pending;
  const aiProgress =
    totalClassifiable > 0
      ? Math.round((classified / totalClassifiable) * 100 * 10) / 10
      : 0;
  return {
    dataCoveragePercent: computeCoverage(snapshot),
    aiClassificationsClassified: classified,
    aiClassificationsTotal: totalClassifiable,
    aiProgressPercent: aiProgress,
    lastUpdatedAt: snapshot.generatedAt.split("T")[0],
  };
}

export async function runFullSync() {
  const startTime = performance.now();
  console.log(`Sincronizando a ${LEGISLATURE}ª legislatura até ${PERIOD_END}`);

  console.log("\n── Fase 1: Downloads ──\n");
  await downloadAll();
  console.log("\n── Fase 2: Processamento ──\n");

  logStage(1, "Deputados");
  const accumulators = await loadLegislatureDeputies();
  logStageDone();

  logStage(2, "Participação");
  await loadParticipation(accumulators);
  logStageDone();

  logStage(3, "Votos públicos");
  const publicVotes = await loadPublicVotes(accumulators);
  logStageDone();

  logStage(4, "Produção");
  await loadProduction(accumulators);
  logStageDone();

  logStage(5, "Gastos parlamentares");
  await loadExpenses(accumulators);
  logStageDone();

  logStage(6, "Dados TSE");
  await loadTse(accumulators);
  logStageDone();

  logStage(7, "Votos eleitorais");
  await loadVotes(accumulators);
  logStageDone();

  logStage(8, "Finanças de campanha");
  await loadCampaignFinanceData(accumulators);
  logStageDone();

  logStage(9, "Servidores");
  await loadStaff(accumulators);
  logStageDone();

  logStage(10, "Emendas");
  await loadAmendments(accumulators);
  logStageDone();

  logStage(11, "Compilando dados");
  const snapshot = buildSnapshot(accumulators);
  const profileDetails = buildProfileDetails(accumulators);
  const classificationPending = buildClassificationPending(accumulators);
  const publicVoteClassificationPending =
    buildPublicVoteClassificationPending(publicVotes);
  await mkdir(new URL("../../.data", import.meta.url), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  await writeFile(
    PROFILE_OUTPUT,
    `${JSON.stringify(profileDetails)}\n`,
  );
  await writeFile(
    PENDING_OUTPUT,
    `${JSON.stringify(classificationPending, null, 2)}\n`,
  );
  await writeFile(
    PUBLIC_VOTE_PENDING_OUTPUT,
    `${JSON.stringify(publicVoteClassificationPending, null, 2)}\n`,
  );
  const bannerMetadata = buildBannerMetadata(snapshot, classificationPending);
  await writeFile(
    BANNER_METADATA_OUTPUT,
    `${JSON.stringify(bannerMetadata, null, 2)}\n`,
  );
  logStageDone();

  const totalElapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(`\n═════════════════════════════════════`);
  console.log(`✅ Concluído em ${totalElapsed}s`);
  console.log(`📄 ${snapshot.deputies.length} parlamentares, ${snapshot.periods.length} períodos`);
  console.log(`⏳ ${classificationPending.total} proposições e ${publicVoteClassificationPending.total} votações pendentes`);
}

export async function runFetch() {
  console.log("\n── Buscando dados ──\n");
  await downloadAll();
  console.log("\n✅ Download concluído");
}

export async function runProcess() {
  const startTime = performance.now();
  console.log(`Processando a ${LEGISLATURE}ª legislatura até ${PERIOD_END}`);

  logStage(1, "Deputados");
  const accumulators = await loadLegislatureDeputies();
  logStageDone();

  logStage(2, "Participação");
  await loadParticipation(accumulators);
  logStageDone();

  logStage(3, "Votos públicos");
  const publicVotes = await loadPublicVotes(accumulators);
  logStageDone();

  logStage(4, "Produção");
  await loadProduction(accumulators);
  logStageDone();

  logStage(5, "Gastos parlamentares");
  await loadExpenses(accumulators);
  logStageDone();

  logStage(6, "Dados TSE");
  await loadTse(accumulators);
  logStageDone();

  logStage(7, "Votos eleitorais");
  await loadVotes(accumulators);
  logStageDone();

  logStage(8, "Finanças de campanha");
  await loadCampaignFinanceData(accumulators);
  logStageDone();

  logStage(9, "Servidores");
  await loadStaff(accumulators);
  logStageDone();

  logStage(10, "Emendas");
  await loadAmendments(accumulators);
  logStageDone();

  logStage(11, "Compilando dados");
  const snapshot = buildSnapshot(accumulators);
  const profileDetails = buildProfileDetails(accumulators);
  const classificationPending = buildClassificationPending(accumulators);
  const publicVoteClassificationPending =
    buildPublicVoteClassificationPending(publicVotes);
  await mkdir(new URL("../../.data", import.meta.url), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  await writeFile(
    PROFILE_OUTPUT,
    `${JSON.stringify(profileDetails)}\n`,
  );
  await writeFile(
    PENDING_OUTPUT,
    `${JSON.stringify(classificationPending, null, 2)}\n`,
  );
  await writeFile(
    PUBLIC_VOTE_PENDING_OUTPUT,
    `${JSON.stringify(publicVoteClassificationPending, null, 2)}\n`,
  );
  const bannerMetadata = buildBannerMetadata(snapshot, classificationPending);
  await writeFile(
    BANNER_METADATA_OUTPUT,
    `${JSON.stringify(bannerMetadata, null, 2)}\n`,
  );
  logStageDone();

  const totalElapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(`\n═════════════════════════════════════`);
  console.log(`✅ Concluído em ${totalElapsed}s`);
  console.log(`📄 ${snapshot.deputies.length} parlamentares, ${snapshot.periods.length} períodos`);
  console.log(`⏳ ${classificationPending.total} proposições e ${publicVoteClassificationPending.total} votações pendentes`);
}
