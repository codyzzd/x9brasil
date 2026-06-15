export const SCORE_WEIGHTS = {
  participation: 0.25,
  production: 0.25,
  resources: 0.25,
  transparency: 0.25,
} as const;

export type ScoreKey = keyof typeof SCORE_WEIGHTS;
export type ScoreBand = "low" | "medium" | "good" | "unavailable";

export type RawMetrics = {
  monthsInOffice: number;
  plenaryAttendances: number | null;
  nominalVotes: number | null;
  substantiveProposals: number | null;
  oversightProposals: number | null;
  advancedProposals: number | null;
  convertedProposals: number | null;
  expensesTotal: number | null;
  expenseDocuments: number | null;
  supplierConcentration: number | null;
  campaignCandidacyAvailable: boolean;
  assetsAvailable: boolean;
  campaignReceiptsAvailable: boolean;
  campaignExpensesAvailable: boolean;
  accountsStatusAvailable: boolean;
};

export type DeputyIdentity = {
  id: number;
  slug: string;
  name: string;
  civilName: string;
  photoUrl: string;
  chamberUrl: string;
  electionNumber: string | null;
  tseSequence: string | null;
  electionStatus: string | null;
  assetsTotal: number | null;
  assetsCount: number | null;
};

export type PeriodDeputyRecord = {
  id: number;
  party: string;
  state: string;
  officeStart: string;
  officeEnd: string;
  daysInOffice: number;
  metrics: RawMetrics;
};

export type RankingPeriod = {
  id: string;
  label: string;
  start: string;
  end: string;
  partial: boolean;
  deputies: PeriodDeputyRecord[];
};

export type RankingSnapshot = {
  version: 2;
  generatedAt: string;
  timezone: "America/Fortaleza";
  defaultPeriod: string;
  sources: Array<{
    name: string;
    url: string;
    updatedAt: string;
  }>;
  deputies: DeputyIdentity[];
  periods: RankingPeriod[];
};

export type DeputyRecord = DeputyIdentity & PeriodDeputyRecord;

export type ScoreDimensions = {
  participation: number | null;
  production: number | null;
  resources: number | null;
  transparency: number;
};

export type RankedDeputy = DeputyRecord & {
  rank: number | null;
  eligible: boolean;
  score: number | null;
  dimensions: ScoreDimensions;
  labels: string[];
};

export type RankChange = {
  currentRank: number | null;
  previousRank: number | null;
  delta: number | null;
  previousPeriod: string | null;
};

export function getRankingPeriod(snapshot: RankingSnapshot, periodId: string) {
  return (
    snapshot.periods.find((period) => period.id === periodId) ||
    snapshot.periods.find((period) => period.id === snapshot.defaultPeriod) ||
    snapshot.periods[0]
  );
}

export function materializePeriod(
  snapshot: RankingSnapshot,
  periodId: string,
): DeputyRecord[] {
  const period = getRankingPeriod(snapshot, periodId);
  if (!period) return [];
  const identities = new Map(snapshot.deputies.map((deputy) => [deputy.id, deputy]));
  return period.deputies.flatMap((periodDeputy) => {
    const identity = identities.get(periodDeputy.id);
    return identity ? [{ ...identity, ...periodDeputy }] : [];
  });
}

export function previousAnnualPeriod(
  snapshot: RankingSnapshot,
  periodId: string,
) {
  const year = Number(periodId);
  if (!Number.isInteger(year)) return null;
  return snapshot.periods.find((period) => period.id === String(year - 1)) || null;
}

export function calculateRankChanges(
  current: RankedDeputy[],
  previous: RankedDeputy[] | null,
  previousPeriod: string | null,
) {
  const previousRanks = new Map(
    (previous || []).map((deputy) => [deputy.id, deputy.rank]),
  );
  return new Map<number, RankChange>(
    current.map((deputy) => {
      const previousRank = previousRanks.get(deputy.id) ?? null;
      return [
        deputy.id,
        {
          currentRank: deputy.rank,
          previousRank,
          delta:
            deputy.rank === null || previousRank === null
              ? null
              : previousRank - deputy.rank,
          previousPeriod,
        },
      ];
    }),
  );
}

export function filterRankingCohort(
  deputies: DeputyRecord[],
  state: string,
  party: string,
) {
  return deputies.filter(
    (deputy) =>
      (state === "all" || deputy.state === state) &&
      (party === "all" || deputy.party === party),
  );
}

export function searchRankedDeputies(deputies: RankedDeputy[], query: string) {
  const normalized = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
  if (!normalized) return deputies;
  return deputies.filter((deputy) =>
    [deputy.name, deputy.civilName, deputy.party, deputy.electionNumber || ""]
      .join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .includes(normalized),
  );
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function perMonth(value: number | null, months: number) {
  if (value === null || months <= 0) return null;
  return value / months;
}

export function percentileRanks(values: Array<number | null>): Array<number | null> {
  const present = values
    .map((value, index) => ({ value, index }))
    .filter((item): item is { value: number; index: number } => item.value !== null)
    .sort((a, b) => a.value - b.value);

  const result: Array<number | null> = values.map(() => null);
  if (present.length === 0) return result;
  if (present.length === 1) {
    result[present[0].index] = 50;
    return result;
  }

  let cursor = 0;
  while (cursor < present.length) {
    let end = cursor;
    while (end + 1 < present.length && present[end + 1].value === present[cursor].value) {
      end += 1;
    }
    const averageRank = (cursor + end) / 2;
    const percentile = (averageRank / (present.length - 1)) * 100;
    for (let index = cursor; index <= end; index += 1) {
      result[present[index].index] = percentile;
    }
    cursor = end + 1;
  }
  return result;
}

export function transparencyScore(metrics: RawMetrics) {
  return [
    metrics.campaignCandidacyAvailable,
    metrics.assetsAvailable,
    metrics.campaignReceiptsAvailable,
    metrics.campaignExpensesAvailable,
    metrics.accountsStatusAvailable,
  ].filter(Boolean).length * 20;
}

export function calculateRanking(deputies: DeputyRecord[]): RankedDeputy[] {
  const attendanceRates = deputies.map((deputy) =>
    perMonth(deputy.metrics.plenaryAttendances, deputy.metrics.monthsInOffice),
  );
  const voteRates = deputies.map((deputy) =>
    perMonth(deputy.metrics.nominalVotes, deputy.metrics.monthsInOffice),
  );
  const productionRates = deputies.map((deputy) => {
    const metrics = deputy.metrics;
    if (
      metrics.substantiveProposals === null ||
      metrics.oversightProposals === null ||
      metrics.advancedProposals === null ||
      metrics.convertedProposals === null
    ) {
      return null;
    }
    return (
      (metrics.substantiveProposals +
        metrics.oversightProposals * 0.5 +
        metrics.advancedProposals * 0.75 +
        metrics.convertedProposals * 2) /
      Math.max(metrics.monthsInOffice, 1)
    );
  });
  const expenseRates = deputies.map((deputy) =>
    perMonth(deputy.metrics.expensesTotal, deputy.metrics.monthsInOffice),
  );

  const attendancePercentiles = percentileRanks(attendanceRates);
  const votePercentiles = percentileRanks(voteRates);
  const productionPercentiles = percentileRanks(productionRates);
  const expensePercentiles = percentileRanks(expenseRates);

  const scored = deputies.map<RankedDeputy>((deputy, index) => {
    const attendance = attendancePercentiles[index];
    const votes = votePercentiles[index];
    const participation =
      attendance === null || votes === null ? null : (attendance + votes) / 2;
    const production = productionPercentiles[index];
    const expense = expensePercentiles[index];
    const concentration = deputy.metrics.supplierConcentration;
    const activity =
      participation === null || production === null
        ? null
        : (participation + production) / 2;
    const expenseAlignment =
      expense === null || activity === null
        ? null
        : 100 - Math.max(0, expense - activity);
    const concentrationScore =
      concentration === null ? null : clamp((1 - concentration) * 100);
    const resources =
      expenseAlignment === null || concentrationScore === null
        ? null
        : expenseAlignment * 0.7 + concentrationScore * 0.3;
    const transparency = transparencyScore(deputy.metrics);
    const eligible =
      deputy.metrics.monthsInOffice >= 3 &&
      participation !== null &&
      production !== null &&
      resources !== null;
    const score = eligible
      ? participation * SCORE_WEIGHTS.participation +
        production * SCORE_WEIGHTS.production +
        resources * SCORE_WEIGHTS.resources +
        transparency * SCORE_WEIGHTS.transparency
      : null;

    return {
      ...deputy,
      rank: null,
      eligible,
      score: score === null ? null : Math.round(score),
      dimensions: {
        participation:
          participation === null ? null : Math.round(participation),
        production: production === null ? null : Math.round(production),
        resources: resources === null ? null : Math.round(resources),
        transparency,
      },
      labels: buildLabels({
        participation,
        production,
        resources,
        transparency,
        concentration,
      }),
    };
  });

  const eligible = scored
    .filter((deputy) => deputy.eligible && deputy.score !== null)
    .sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
        a.name.localeCompare(b.name, "pt-BR"),
    );
  eligible.forEach((deputy, index) => {
    deputy.rank = index + 1;
  });

  return [
    ...eligible,
    ...scored
      .filter((deputy) => !deputy.eligible)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  ];
}

function buildLabels({
  participation,
  production,
  resources,
  transparency,
  concentration,
}: {
  participation: number | null;
  production: number | null;
  resources: number | null;
  transparency: number;
  concentration: number | null;
}) {
  const labels: string[] = [];
  if (participation !== null) {
    if (participation >= 75) labels.push("Participação alta");
    if (participation <= 25) labels.push("Participação abaixo da mediana");
  }
  if (production !== null) {
    if (production >= 75) labels.push("Produção alta");
    if (production <= 25) labels.push("Produção abaixo da mediana");
  }
  if (resources !== null && resources >= 75) labels.push("Uso de recursos equilibrado");
  if (concentration !== null && concentration >= 0.5) labels.push("Gastos concentrados");
  if (transparency < 60) labels.push("Dados incompletos");
  return labels.slice(0, 3);
}

export function formatCurrency(value: number | null) {
  if (value === null) return "Dados indisponíveis";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function scoreLabel(score: number | null) {
  const band = scoreBand(score);
  if (band === "good") return "Bom";
  if (band === "medium") return "Médio";
  if (band === "low") return "Baixo";
  return "Sem posição";
}

export function scoreBand(score: number | null): ScoreBand {
  if (score === null) return "unavailable";
  if (score >= 65) return "good";
  if (score >= 50) return "medium";
  return "low";
}
