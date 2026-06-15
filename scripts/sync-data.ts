import { mkdir, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { parse } from "csv-parse";
import AdmZip from "adm-zip";
import type {
  DeputyIdentity,
  PeriodDeputyRecord,
  ProfileDetailsSnapshot,
  ProfilePeriodDetails,
  RankingPeriod,
  RankingSnapshot,
  RawMetrics,
} from "../src/lib/ranking";

const LEGISLATURE = 57;
const PERIOD_START = "2023-02-01";
const PERIOD_END = new Date().toISOString().slice(0, 10);
const CURRENT_YEAR = Number(PERIOD_END.slice(0, 4));
const YEARS = Array.from(
  { length: CURRENT_YEAR - 2022 },
  (_, index) => 2023 + index,
);
const OUTPUT = new URL("../src/data/ranking-snapshot.json", import.meta.url);
const PROFILE_OUTPUT = new URL(
  "../src/data/profile-details.json",
  import.meta.url,
);
const CHAMBER_API = "https://dadosabertos.camara.leg.br/api/v2";
const CHAMBER_FILES = "https://dadosabertos.camara.leg.br/arquivos";
const TSE_FILES = "https://cdn.tse.jus.br/estatistica/sead/odsele";
const USER_AGENT = "x9brasil/2.0";

type ChamberDeputy = {
  id: number;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  urlFoto: string;
  uri: string;
};

type DeputyStatus = {
  dataHora: string;
  situacao: string | null;
  siglaPartido: string;
  siglaUf: string;
};

type ExerciseInterval = {
  start: string;
  end: string;
  party: string;
  state: string;
};

type PeriodAccumulator = {
  daysInOffice: number;
  officeStart: string;
  officeEnd: string;
  partyDays: Map<string, number>;
  stateDays: Map<string, number>;
  plenaryAttendances: Set<string>;
  nominalVotes: Set<string>;
  substantiveProposals: Set<string>;
  oversightProposals: Set<string>;
  advancedProposals: Set<string>;
  convertedProposals: Set<string>;
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
};

type DeputyAccumulator = {
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

function timestamp(value: string) {
  return new Date(`${value}T00:00:00Z`).getTime();
}

function daysInclusive(start: string, end: string) {
  return Math.max(1, Math.floor((timestamp(end) - timestamp(start)) / 86_400_000) + 1);
}

function dayBefore(value: string) {
  return new Date(timestamp(value) - 86_400_000).toISOString().slice(0, 10);
}

function periodDefinitions() {
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

const PERIODS = periodDefinitions();

function emptyPeriod(): PeriodAccumulator {
  return {
    daysInOffice: 0,
    officeStart: PERIOD_END,
    officeEnd: PERIOD_START,
    partyDays: new Map(),
    stateDays: new Map(),
    plenaryAttendances: new Set(),
    nominalVotes: new Set(),
    substantiveProposals: new Set(),
    oversightProposals: new Set(),
    advancedProposals: new Set(),
    convertedProposals: new Set(),
    expensesTotal: 0,
    expenseDocuments: 0,
    suppliers: new Map(),
    expenseCategories: new Map(),
    largestExpenses: [],
    proposals: new Map(),
    amendments: [],
  };
}

function periodIdsForDate(date: string | null) {
  if (!date || date < PERIOD_START || date > PERIOD_END) return [];
  return [date.slice(0, 4), "legislature"];
}

async function fetchJson<T>(url: string, attempt = 0): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
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
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ao baixar ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function forEachRemoteCsv(url: string, onRow: (row: CsvRow) => void) {
  console.log(`Lendo ${url}`);
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
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

function buildIntervals(statuses: DeputyStatus[]) {
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

function addExercisePeriods(accumulator: DeputyAccumulator) {
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

async function loadLegislatureDeputies() {
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
  const details = await mapLimit(unique, 8, async (deputy) => {
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
  });

  return new Map(
    details.map(
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
      };
      addExercisePeriods(accumulator);
      return [deputy.id, accumulator];
      },
    ),
  );
}

function forDatePeriods(
  accumulator: DeputyAccumulator,
  date: string | null,
  callback: (period: PeriodAccumulator) => void,
) {
  for (const periodId of periodIdsForDate(date)) {
    const period = accumulator.periods.get(periodId);
    if (period) callback(period);
  }
}

async function loadParticipation(accumulators: Map<number, DeputyAccumulator>) {
  for (const year of YEARS) {
    const eligibleEvents = new Set<string>();
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/eventos/csv/eventos-${year}.csv`,
      (row) => {
        if (
          row.situacao === "Encerrada" &&
          row.descricaoTipo === "Sessão Deliberativa" &&
          dateOnly(row.dataHoraInicio) &&
          dateOnly(row.dataHoraInicio)! <= PERIOD_END
        ) {
          eligibleEvents.add(row.id);
        }
      },
    );
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
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/votacoesVotos/csv/votacoesVotos-${year}.csv`,
      (row) => {
        const accumulator = accumulators.get(Number(row.deputado_id));
        if (!accumulator) return;
        forDatePeriods(accumulator, dateOnly(row.dataHoraVoto), (period) => {
          period.nominalVotes.add(row.idVotacao);
        });
      },
    );
  }
}

async function loadProduction(accumulators: Map<number, DeputyAccumulator>) {
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
        if (substantiveTypes.has(row.siglaTipo) || oversightTypes.has(row.siglaTipo)) {
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
  for (const year of YEARS) {
    await forEachRemoteCsv(
      `${CHAMBER_FILES}/proposicoesAutores/csv/proposicoesAutores-${year}.csv`,
      (row) => {
        if (row.proponente !== "1" || !proposals.has(row.idProposicao)) return;
        const deputyId = Number(row.idDeputadoAutor);
        const accumulator = accumulators.get(deputyId);
        const proposal = proposals.get(row.idProposicao);
        if (!accumulator || !proposal) return;
        authors.set(row.idProposicao, deputyId);
        forDatePeriods(accumulator, proposal.date, (period) => {
          if (substantiveTypes.has(proposal.type)) {
            period.substantiveProposals.add(row.idProposicao);
          } else {
            period.oversightProposals.add(row.idProposicao);
          }
          period.proposals.set(row.idProposicao, {
            id: row.idProposicao,
            type: proposal.type,
            number: proposal.number,
            year: proposal.year,
            date: proposal.date || `${proposal.year}-01-01`,
            summary: proposal.summary,
            status: proposal.status,
            url: proposal.url,
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
        const deputyId = authors.get(proposalId);
        const accumulator = deputyId ? accumulators.get(deputyId) : null;
        if (!accumulator) return;
        const text = `${row.descricaoTramitacao || ""} ${row.despacho || ""}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase("pt-BR");
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
      },
    );
  }
}

async function loadExpenses(accumulators: Map<number, DeputyAccumulator>) {
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

async function loadTse(accumulators: Map<number, DeputyAccumulator>) {
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

  const candidateZip = new AdmZip(
    await fetchBuffer(`${TSE_FILES}/consulta_cand/consulta_cand_2022.zip`),
  );
  const candidateEntry = candidateZip.getEntry("consulta_cand_2022_BRASIL.csv");
  if (!candidateEntry) throw new Error("Arquivo nacional de candidatos não encontrado");
  await forEachBufferCsv(candidateEntry.getData(), "latin1", (row) => {
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
  const assetsZip = new AdmZip(
    await fetchBuffer(`${TSE_FILES}/bem_candidato/bem_candidato_2022.zip`),
  );
  const assetsEntry = assetsZip.getEntry("bem_candidato_2022_BRASIL.csv");
  if (!assetsEntry) throw new Error("Arquivo nacional de bens não encontrado");
  await forEachBufferCsv(assetsEntry.getData(), "latin1", (row) => {
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

async function loadStaff(accumulators: Map<number, DeputyAccumulator>) {
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

async function loadAmendments(accumulators: Map<number, DeputyAccumulator>) {
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

function dominantValue(values: Map<string, number>, fallback: string) {
  return (
    [...values.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || fallback
  );
}

function buildPeriodDeputy(
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
    nominalVotes: period.nominalVotes.size,
    substantiveProposals: period.substantiveProposals.size,
    oversightProposals: period.oversightProposals.size,
    advancedProposals: period.advancedProposals.size,
    convertedProposals: period.convertedProposals.size,
    expensesTotal,
    expenseDocuments: period.expenseDocuments || null,
    supplierConcentration,
    campaignCandidacyAvailable: Boolean(item.tseSequence),
    assetsAvailable: item.assetsCount !== null,
    campaignReceiptsAvailable: false,
    campaignExpensesAvailable: false,
    accountsStatusAvailable: false,
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

function buildProfilePeriod(
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
      .slice(0, 10),
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

function buildSnapshot(accumulators: Map<number, DeputyAccumulator>): RankingSnapshot {
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

function buildProfileDetails(
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

async function main() {
  console.log(`Sincronizando a ${LEGISLATURE}ª legislatura até ${PERIOD_END}`);
  const accumulators = await loadLegislatureDeputies();
  await loadParticipation(accumulators);
  await loadProduction(accumulators);
  await loadExpenses(accumulators);
  await loadTse(accumulators);
  await loadStaff(accumulators);
  await loadAmendments(accumulators);
  const snapshot = buildSnapshot(accumulators);
  const profileDetails = buildProfileDetails(accumulators);
  await mkdir(new URL("../src/data", import.meta.url), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  await writeFile(
    PROFILE_OUTPUT,
    `${JSON.stringify(profileDetails)}\n`,
  );
  console.log(
    `Snapshot v2 salvo com ${snapshot.deputies.length} parlamentares e ${snapshot.periods.length} períodos`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
