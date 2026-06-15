import { mkdir, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { parse } from "csv-parse";
import AdmZip from "adm-zip";
import type {
  DeputyRecord,
  RankingSnapshot,
  RawMetrics,
} from "../src/lib/ranking";

const PERIOD_START = "2023-02-01";
const PERIOD_END = new Date().toISOString().slice(0, 10);
const YEARS = Array.from(
  { length: Number(PERIOD_END.slice(0, 4)) - 2022 },
  (_, index) => 2023 + index,
);
const OUTPUT = new URL("../src/data/ranking-snapshot.json", import.meta.url);
const CHAMBER_API = "https://dadosabertos.camara.leg.br/api/v2";
const CHAMBER_FILES = "https://dadosabertos.camara.leg.br/arquivos";
const TSE_FILES = "https://cdn.tse.jus.br/estatistica/sead/odsele";

type ChamberDeputy = {
  id: number;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  urlFoto: string;
  uri: string;
};

type DeputyAccumulator = {
  deputy: ChamberDeputy;
  civilName: string;
  statusDate: string;
  earliestActivity: string | null;
  plenaryAttendances: Set<string>;
  nominalVotes: Set<string>;
  substantiveProposals: Set<string>;
  oversightProposals: Set<string>;
  advancedProposals: Set<string>;
  convertedProposals: Set<string>;
  expensesTotal: number;
  expenseDocuments: number;
  supplierTotals: Map<string, number>;
  tseSequence: string | null;
  electionNumber: string | null;
  electionStatus: string | null;
  assetsTotal: number | null;
  assetsCount: number | null;
};

type CsvRow = Record<string, string>;

const substantiveTypes = new Set(["PL", "PLP", "PEC", "PDL", "PRC"]);
const oversightTypes = new Set(["RIC", "PFC"]);

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
}

function slugify(value: string, id: number) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base}-${id}`;
}

function numberFrom(value: string | undefined) {
  if (!value) return 0;
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnly(value: string | undefined) {
  return value?.slice(0, 10) || null;
}

function registerActivity(accumulator: DeputyAccumulator, date: string | null) {
  if (!date || date < PERIOD_START || date > PERIOD_END) return;
  if (!accumulator.earliestActivity || date < accumulator.earliestActivity) {
    accumulator.earliestActivity = date;
  }
}

function monthsBetween(start: string, end: string) {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  const days = Math.max(1, (to.getTime() - from.getTime()) / 86_400_000);
  return Math.max(1, days / 30.4375);
}

async function fetchJson<T>(url: string, attempt = 0): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "raio-x-eleitoral/1.0" },
  });
  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
    const delay = Math.max(retryAfter, 750 * 2 ** attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchJson<T>(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status} ao consultar ${url}`);
  return response.json() as Promise<T>;
}

async function fetchBuffer(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "raio-x-eleitoral/1.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ao baixar ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function forEachRemoteCsv(
  url: string,
  onRow: (row: CsvRow) => void,
) {
  console.log(`Lendo ${url}`);
  const response = await fetch(url, {
    headers: { "user-agent": "raio-x-eleitoral/1.0" },
  });
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ao baixar ${url}`);
  }
  const parser = Readable.fromWeb(
    response.body as Parameters<typeof Readable.fromWeb>[0],
  ).pipe(
    parse({
      bom: true,
      columns: true,
      delimiter: ";",
      relax_quotes: true,
      relax_column_count: true,
    }),
  );
  for await (const row of parser) onRow(row as CsvRow);
}

async function forEachBufferCsv(
  buffer: Buffer,
  encoding: "utf8" | "latin1",
  onRow: (row: CsvRow) => void,
) {
  const parser = Readable.from(buffer.toString(encoding)).pipe(
    parse({
      bom: true,
      columns: true,
      delimiter: ";",
      relax_quotes: true,
      relax_column_count: true,
    }),
  );
  for await (const row of parser) onRow(row as CsvRow);
}

async function mapLimit<T, R>(
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

async function loadCurrentDeputies() {
  const deputies: ChamberDeputy[] = [];
  for (let page = 1; page <= 6; page += 1) {
    const response = await fetchJson<{
      dados: ChamberDeputy[];
      links: Array<{ rel: string }>;
    }>(
      `${CHAMBER_API}/deputados?itens=100&pagina=${page}&ordem=ASC&ordenarPor=nome`,
    );
    deputies.push(...response.dados);
    if (!response.links.some((link) => link.rel === "next")) break;
  }

  console.log(`Carregando detalhes de ${deputies.length} deputados`);
  const details = await mapLimit(deputies, 4, async (deputy) => {
    const response = await fetchJson<{
      dados: {
        nomeCivil: string;
        ultimoStatus: { data: string | null };
      };
    }>(`${CHAMBER_API}/deputados/${deputy.id}`);
    return {
      deputy,
      civilName: response.dados.nomeCivil,
      statusDate: response.dados.ultimoStatus.data || PERIOD_START,
    };
  });

  return new Map(
    details.map(({ deputy, civilName, statusDate }) => [
      deputy.id,
      {
        deputy,
        civilName,
        statusDate,
        earliestActivity: null,
        plenaryAttendances: new Set<string>(),
        nominalVotes: new Set<string>(),
        substantiveProposals: new Set<string>(),
        oversightProposals: new Set<string>(),
        advancedProposals: new Set<string>(),
        convertedProposals: new Set<string>(),
        expensesTotal: 0,
        expenseDocuments: 0,
        supplierTotals: new Map<string, number>(),
        tseSequence: null,
        electionNumber: null,
        electionStatus: null,
        assetsTotal: null,
        assetsCount: null,
      } satisfies DeputyAccumulator,
    ]),
  );
}

async function loadParticipation(accumulators: Map<number, DeputyAccumulator>) {
  const eligibleEvents = new Set<string>();
  for (const year of YEARS) {
    await forEachRemoteCsv(`${CHAMBER_FILES}/eventos/csv/eventos-${year}.csv`, (row) => {
      if (
        row.situacao === "Encerrada" &&
        row.descricaoTipo === "Sessão Deliberativa" &&
        dateOnly(row.dataHoraInicio) &&
        dateOnly(row.dataHoraInicio)! <= PERIOD_END
      ) {
        eligibleEvents.add(row.id);
      }
    });
  }

  for (const year of YEARS) {
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/eventosPresencaDeputados/csv/eventosPresencaDeputados-${year}.csv`,
      (row) => {
        if (!eligibleEvents.has(row.idEvento)) return;
        const accumulator = accumulators.get(Number(row.idDeputado));
        if (!accumulator) return;
        accumulator.plenaryAttendances.add(row.idEvento);
        registerActivity(accumulator, dateOnly(row.dataHoraInicio));
      },
    );
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/votacoesVotos/csv/votacoesVotos-${year}.csv`,
      (row) => {
        const accumulator = accumulators.get(Number(row.deputado_id));
        if (!accumulator) return;
        accumulator.nominalVotes.add(row.idVotacao);
        registerActivity(accumulator, dateOnly(row.dataHoraVoto));
      },
    );
  }
}

async function loadProduction(accumulators: Map<number, DeputyAccumulator>) {
  const proposals = new Map<
    string,
    { type: string; date: string | null; advanced: boolean; converted: boolean }
  >();
  for (const year of YEARS) {
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/proposicoes/csv/proposicoes-${year}.csv`,
      (row) => {
        if (!substantiveTypes.has(row.siglaTipo) && !oversightTypes.has(row.siglaTipo)) {
          return;
        }
        proposals.set(row.id, {
          type: row.siglaTipo,
          date: dateOnly(row.dataApresentacao),
          advanced: numberFrom(row.ultimoStatus_sequencia) > 1,
          converted:
            Boolean(row.urnFinal) ||
            row.ultimoStatus_descricaoSituacao
              ?.toLocaleLowerCase("pt-BR")
              .includes("transformado em norma"),
        });
      },
    );
  }

  for (const year of YEARS) {
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/proposicoesAutores/csv/proposicoesAutores-${year}.csv`,
      (row) => {
        if (row.proponente !== "1") return;
        const accumulator = accumulators.get(Number(row.idDeputadoAutor));
        const proposal = proposals.get(row.idProposicao);
        if (!accumulator || !proposal) return;
        if (substantiveTypes.has(proposal.type)) {
          accumulator.substantiveProposals.add(row.idProposicao);
        } else {
          accumulator.oversightProposals.add(row.idProposicao);
        }
        if (proposal.advanced) accumulator.advancedProposals.add(row.idProposicao);
        if (proposal.converted) accumulator.convertedProposals.add(row.idProposicao);
        registerActivity(accumulator, proposal.date);
      },
    );
  }
}

async function loadExpenses(accumulators: Map<number, DeputyAccumulator>) {
  for (const year of YEARS) {
    const url = `https://www.camara.leg.br/cotas/Ano-${year}.csv.zip`;
    console.log(`Lendo ${url}`);
    const zip = new AdmZip(await fetchBuffer(url));
    const entry = zip
      .getEntries()
      .find((candidate) => candidate.entryName.endsWith(".csv"));
    if (!entry) throw new Error(`CSV não encontrado em ${url}`);
    await forEachBufferCsv(entry.getData(), "utf8", (row) => {
      const accumulator = accumulators.get(Number(row.ideCadastro));
      if (!accumulator) return;
      const amount = numberFrom(row.vlrLiquido);
      if (amount <= 0) return;
      accumulator.expensesTotal += amount;
      accumulator.expenseDocuments += 1;
      const supplier = normalize(row.txtCNPJCPF || row.txtFornecedor || "NAO INFORMADO");
      accumulator.supplierTotals.set(
        supplier,
        (accumulator.supplierTotals.get(supplier) || 0) + amount,
      );
      registerActivity(accumulator, dateOnly(row.datEmissao));
    });
  }
}

async function loadTse(accumulators: Map<number, DeputyAccumulator>) {
  const byCivilNameAndState = new Map<string, DeputyAccumulator[]>();
  for (const accumulator of accumulators.values()) {
    const key = `${normalize(accumulator.civilName)}:${accumulator.deputy.siglaUf}`;
    byCivilNameAndState.set(key, [
      ...(byCivilNameAndState.get(key) || []),
      accumulator,
    ]);
  }

  const candidateZip = new AdmZip(
    await fetchBuffer(`${TSE_FILES}/consulta_cand/consulta_cand_2022.zip`),
  );
  const candidateEntry = candidateZip.getEntry("consulta_cand_2022_BRASIL.csv");
  if (!candidateEntry) throw new Error("Arquivo nacional de candidatos não encontrado");
  await forEachBufferCsv(candidateEntry.getData(), "latin1", (row) => {
    if (row.DS_CARGO !== "DEPUTADO FEDERAL") return;
    const key = `${normalize(row.NM_CANDIDATO)}:${row.SG_UF}`;
    const matches = byCivilNameAndState.get(key);
    if (!matches || matches.length !== 1) return;
    const accumulator = matches[0];
    accumulator.tseSequence = row.SQ_CANDIDATO;
    accumulator.electionNumber = row.NR_CANDIDATO;
    accumulator.electionStatus = row.DS_SITUACAO_CANDIDATURA;
  });

  const bySequence = new Map<string, DeputyAccumulator>();
  for (const accumulator of accumulators.values()) {
    if (accumulator.tseSequence) {
      bySequence.set(accumulator.tseSequence, accumulator);
    }
  }
  const assetsZip = new AdmZip(
    await fetchBuffer(`${TSE_FILES}/bem_candidato/bem_candidato_2022.zip`),
  );
  const assetsEntry = assetsZip.getEntry("bem_candidato_2022_BRASIL.csv");
  if (!assetsEntry) throw new Error("Arquivo nacional de bens não encontrado");
  await forEachBufferCsv(assetsEntry.getData(), "latin1", (row) => {
    const accumulator = bySequence.get(row.SQ_CANDIDATO);
    if (!accumulator) return;
    accumulator.assetsTotal =
      (accumulator.assetsTotal || 0) + numberFrom(row.VR_BEM_CANDIDATO);
    accumulator.assetsCount = (accumulator.assetsCount || 0) + 1;
  });
}

function buildSnapshot(accumulators: Map<number, DeputyAccumulator>): RankingSnapshot {
  const deputies = Array.from(accumulators.values()).map<DeputyRecord>((item) => {
    const startCandidates = [
      item.statusDate.slice(0, 10),
      item.earliestActivity,
    ].filter((value): value is string => value !== null && value >= PERIOD_START);
    const officeStart = startCandidates.sort()[0] || PERIOD_START;
    const expensesTotal = item.expenseDocuments > 0 ? item.expensesTotal : null;
    let supplierConcentration: number | null = null;
    if (expensesTotal && expensesTotal > 0) {
      supplierConcentration = Array.from(item.supplierTotals.values()).reduce(
        (sum, amount) => sum + (amount / expensesTotal) ** 2,
        0,
      );
    }

    const metrics: RawMetrics = {
      monthsInOffice: Number(monthsBetween(officeStart, PERIOD_END).toFixed(2)),
      plenaryAttendances: item.plenaryAttendances.size,
      nominalVotes: item.nominalVotes.size,
      substantiveProposals: item.substantiveProposals.size,
      oversightProposals: item.oversightProposals.size,
      advancedProposals: item.advancedProposals.size,
      convertedProposals: item.convertedProposals.size,
      expensesTotal,
      expenseDocuments: item.expenseDocuments || null,
      supplierConcentration,
      campaignCandidacyAvailable: Boolean(item.tseSequence),
      assetsAvailable: item.assetsCount !== null,
      campaignReceiptsAvailable: false,
      campaignExpensesAvailable: false,
      accountsStatusAvailable: false,
    };

    return {
      id: item.deputy.id,
      slug: slugify(item.deputy.nome, item.deputy.id),
      name: item.deputy.nome,
      civilName: item.civilName,
      party: item.deputy.siglaPartido,
      state: item.deputy.siglaUf,
      photoUrl: item.deputy.urlFoto,
      chamberUrl: item.deputy.uri,
      electionNumber: item.electionNumber,
      tseSequence: item.tseSequence,
      electionStatus: item.electionStatus,
      assetsTotal: item.assetsTotal,
      assetsCount: item.assetsCount,
      officeStart,
      metrics,
    };
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    period: {
      start: PERIOD_START,
      end: PERIOD_END,
      timezone: "America/Fortaleza",
    },
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
  };
}

async function main() {
  console.log(`Sincronizando legislatura atual de ${PERIOD_START} a ${PERIOD_END}`);
  const accumulators = await loadCurrentDeputies();
  await loadParticipation(accumulators);
  await loadProduction(accumulators);
  await loadExpenses(accumulators);
  await loadTse(accumulators);
  const snapshot = buildSnapshot(accumulators);
  await mkdir(new URL("../src/data", import.meta.url), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Snapshot salvo com ${snapshot.deputies.length} deputados`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
