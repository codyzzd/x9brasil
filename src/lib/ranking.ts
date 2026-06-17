import { PUBLIC_VALUE_WEIGHTS } from "@/lib/public-value";

export const SCORE_WEIGHTS = {
  participation: 0.30,
  production: 0.30,
  resources: 0.30,
  campaignFinance: 0.10,
} as const;

export const CAMPAIGN_FINANCE_INDICATOR_WEIGHTS = {
  costPerVote: 0.35,
  publicDependency: 0.25,
  donorConcentration: 0.15,
  supplierConcentration: 0.15,
  patrimonyConsistency: 0.10,
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
  authorProposals: number | null;
  coauthorProposals: number | null;
  requesterProposals: number | null;
  fiscalizationProposals: number | null;
  expensesTotal: number | null;
  expenseDocuments: number | null;
  supplierConcentration: number | null;
  campaignCandidacyAvailable: boolean;
  assetsAvailable: boolean;
  totalVotes: number | null;
  totalCampaignReceipts: number | null;
  totalPublicReceipts: number | null;
  totalCampaignExpenses: number | null;
  topDonors: Array<{ name: string; value: number }>;
  topSuppliers: Array<{ name: string; value: number }>;
  publicContributionPoints?: number | null;
  publicClassifiedProposals?: number;
  publicTotalProposals?: number;
  publicVotePositivePoints?: number;
  publicVoteNegativePenalties?: number;
  publicVoteAbsencePenalties?: number;
  publicVotesAnalyzed?: number;
  publicVoteAverageConfidence?: number | null;
  publicVoteScore?: number | null;
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

export type ProfileIdentityDetails = {
  id: number;
  birthDate: string | null;
  birthPlace: string | null;
  education: string | null;
  office: string | null;
  staff: Array<{
    name: string;
    role: string;
    startDate: string | null;
  }>;
  assets: Array<{
    type: string;
    description: string;
    value: number;
  }>;
};

export type ProfilePeriodDetails = {
  id: number;
  expenseCategories: Array<{
    name: string;
    total: number;
    documents: number;
  }>;
  suppliers: Array<{
    name: string;
    taxId: string | null;
    total: number;
    documents: number;
  }>;
  largestExpenses: Array<{
    category: string;
    supplier: string;
    date: string;
    value: number;
    documentUrl: string | null;
  }>;
  proposals: Array<{
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
    publicValue?: {
      category: string;
      categoryLabel: string;
      categoryWeight: number;
      confidence: string;
      justification: string;
      source: string;
      stage: string;
      stageMultiplier: number;
      points: number;
      methodologyVersion: string;
      roleWeight: number;
      natureWeight: number;
      progressBonus: number;
      scoreExplanation: string;
    } | null;
  }>;
  publicVotes?: Array<{
    voteId: string;
    date: string;
    description: string;
    summary: string;
    url: string;
    candidateVote: string;
    classification: string;
    severity: string;
    scoreDelta: number;
    confidence: number;
    reason: string;
    source: string;
    reviewedManually: boolean;
  }>;
  amendments: Array<{
    number: string;
    year: string;
    type: string;
    beneficiary: string;
    proposedValue: number;
    transferredValue: number;
  }>;
};

export type ProfileDetailsSnapshot = {
  version: 1;
  generatedAt: string;
  deputies: ProfileIdentityDetails[];
  periods: Array<{
    id: string;
    deputies: ProfilePeriodDetails[];
  }>;
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
  campaignFinance: number | null;
};

export type RankedDeputy = DeputyRecord & {
  rank: number | null;
  eligible: boolean;
  score: number | null;
  dimensions: ScoreDimensions;
  labels: string[];
};

export type PublicValueDimensions = {
  contribution: number | null;
  publicVotes: number | null;
  efficiency: number | null;
  participation: number | null;
  campaignFinance: number | null;
};

export type PublicValueRankedDeputy = DeputyRecord & {
  rank: number | null;
  eligible: boolean;
  score: number | null;
  dimensions: PublicValueDimensions;
  labels: string[];
};

export type RankingIndex = "current" | "public-value";
export type RankingComparison = "legislature-start" | "previous-year";

export type RankChange = {
  currentRank: number | null;
  previousRank: number | null;
  delta: number | null;
  previousPeriod: string | null;
};

export function getRankingPeriod(snapshot: RankingSnapshot, periodId: string) {
  return (
    snapshot.periods.find((period) => period.id === periodId) ||
    defaultRankingPeriod(snapshot) ||
    snapshot.periods[0]
  );
}

export function defaultRankingPeriod(snapshot: RankingSnapshot) {
  return (
    snapshot.periods.find((period) => period.id === "legislature") ||
    snapshot.periods.find((period) => period.id === snapshot.defaultPeriod) ||
    snapshot.periods[0]
  );
}

export function periodSelectOrder<T extends { id: string }>(periods: T[]): T[] {
  const legislature = periods.find((p) => p.id === "legislature");
  const years = periods
    .filter((p) => p.id !== "legislature")
    .sort((a, b) => {
      const na = Number(a.id);
      const nb = Number(b.id);
      return nb - na;
    });
  return legislature ? [legislature, ...years] : years;
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

export function comparisonPeriod(
  snapshot: RankingSnapshot,
  periodId: string,
  comparison: RankingComparison,
) {
  if (comparison === "previous-year") {
    return previousAnnualPeriod(snapshot, periodId);
  }

  const year = Number(periodId);
  if (!Number.isInteger(year)) return null;

  return (
    snapshot.periods
      .filter(
        (period) =>
          /^\d{4}$/.test(period.id) && Number(period.id) < year,
      )
      .sort((a, b) => Number(a.id) - Number(b.id))[0] || null
  );
}

export function calculateRankChanges(
  current: Array<{ id: number; rank: number | null }>,
  previous: Array<{ id: number; rank: number | null }> | null,
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

export function searchRankedDeputies<
  T extends DeputyIdentity & { party: string },
>(deputies: T[], query: string) {
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

export function campaignFinanceScore(metrics: RawMetrics, assetsTotal: number | null) {
  const costPerVote =
    metrics.totalCampaignExpenses != null && metrics.totalVotes != null && metrics.totalVotes > 0
      ? metrics.totalCampaignExpenses / metrics.totalVotes
      : null;
  const publicDependency =
    metrics.totalPublicReceipts != null && metrics.totalCampaignReceipts != null && metrics.totalCampaignReceipts > 0
      ? metrics.totalPublicReceipts / metrics.totalCampaignReceipts
      : null;
  const donorConcentration = metrics.topDonors?.length > 0
    ? metrics.topDonors.slice(0, 3).reduce((s, d) => s + d.value, 0) /
      metrics.topDonors.reduce((s, d) => s + d.value, 0)
    : null;
  const supplierConcentration = metrics.topSuppliers?.length > 0
    ? metrics.topSuppliers.slice(0, 3).reduce((s, d) => s + d.value, 0) /
      metrics.topSuppliers.reduce((s, d) => s + d.value, 0)
    : null;
  const patrimonyConsistency =
    !metrics.assetsAvailable ? null
    : (assetsTotal === null || assetsTotal === 0) ? 20
    : 75;
  return { costPerVote, publicDependency, donorConcentration, supplierConcentration, patrimonyConsistency };
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

  const cfIndicators = deputies.map((deputy) =>
    campaignFinanceScore(deputy.metrics, deputy.assetsTotal),
  );
  const costPerVoteInverted = cfIndicators.map((i) =>
    i.costPerVote !== null ? 100 - i.costPerVote * 1000 : null,
  );
  const publicDependencyInverted = cfIndicators.map((i) =>
    i.publicDependency !== null ? 100 - i.publicDependency * 100 : null,
  );
  const donorConcInverted = cfIndicators.map((i) =>
    i.donorConcentration !== null ? 100 - i.donorConcentration * 100 : null,
  );
  const supplierConcInverted = cfIndicators.map((i) =>
    i.supplierConcentration !== null ? 100 - i.supplierConcentration * 100 : null,
  );

  const costPerVotePercentiles = percentileRanks(costPerVoteInverted);
  const publicDependencyPercentiles = percentileRanks(publicDependencyInverted);
  const donorConcPercentiles = percentileRanks(donorConcInverted);
  const supplierConcPercentiles = percentileRanks(supplierConcInverted);
  const patrimonyConsistencyPercentiles = percentileRanks(cfIndicators.map((i) => i.patrimonyConsistency));

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

    let cfScoreSum = 0;
    let cfWeightSum = 0;
    const CF_W = CAMPAIGN_FINANCE_INDICATOR_WEIGHTS;
    if (costPerVotePercentiles[index] !== null) {
      cfScoreSum += costPerVotePercentiles[index]! * CF_W.costPerVote;
      cfWeightSum += CF_W.costPerVote;
    }
    if (publicDependencyPercentiles[index] !== null) {
      cfScoreSum += publicDependencyPercentiles[index]! * CF_W.publicDependency;
      cfWeightSum += CF_W.publicDependency;
    }
    if (donorConcPercentiles[index] !== null) {
      cfScoreSum += donorConcPercentiles[index]! * CF_W.donorConcentration;
      cfWeightSum += CF_W.donorConcentration;
    }
    if (supplierConcPercentiles[index] !== null) {
      cfScoreSum += supplierConcPercentiles[index]! * CF_W.supplierConcentration;
      cfWeightSum += CF_W.supplierConcentration;
    }
    if (patrimonyConsistencyPercentiles[index] !== null) {
      cfScoreSum += patrimonyConsistencyPercentiles[index]! * CF_W.patrimonyConsistency;
      cfWeightSum += CF_W.patrimonyConsistency;
    }
    const campaignFinance = cfWeightSum > 0 ? cfScoreSum / cfWeightSum : null;

    const eligible =
      deputy.metrics.monthsInOffice >= 3 &&
      participation !== null &&
      production !== null &&
      resources !== null;

    let scoreSum = 0;
    let weightSum = 0;
    if (participation !== null) {
      scoreSum += participation * SCORE_WEIGHTS.participation;
      weightSum += SCORE_WEIGHTS.participation;
    }
    if (production !== null) {
      scoreSum += production * SCORE_WEIGHTS.production;
      weightSum += SCORE_WEIGHTS.production;
    }
    if (resources !== null) {
      scoreSum += resources * SCORE_WEIGHTS.resources;
      weightSum += SCORE_WEIGHTS.resources;
    }
    if (campaignFinance !== null) {
      scoreSum += campaignFinance * SCORE_WEIGHTS.campaignFinance;
      weightSum += SCORE_WEIGHTS.campaignFinance;
    }
    const score = eligible && weightSum > 0
      ? scoreSum / weightSum
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
        campaignFinance:
          campaignFinance === null ? null : Math.round(campaignFinance),
      },
      labels: buildLabels({
        participation,
        production,
        resources,
        campaignFinance,
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

export function calculatePublicValueRanking(
  deputies: DeputyRecord[],
): PublicValueRankedDeputy[] {
  const contributionRates = deputies.map((deputy) => {
    const points = deputy.metrics.publicContributionPoints;
    const classified = deputy.metrics.publicClassifiedProposals || 0;
    if (points === null || points === undefined || classified === 0) return null;
    return perMonth(points, deputy.metrics.monthsInOffice);
  });
  const efficiencyRates = deputies.map((deputy) => {
    const points = deputy.metrics.publicContributionPoints;
    const expenses = deputy.metrics.expensesTotal;
    const classified = deputy.metrics.publicClassifiedProposals || 0;
    if (
      points === null ||
      points === undefined ||
      classified === 0 ||
      expenses === null ||
      expenses <= 0
    ) {
      return null;
    }
    return (points / expenses) * 100_000;
  });
  const publicVoteRates = deputies.map((deputy) => {
    const score = deputy.metrics.publicVoteScore;
    const analyzed = deputy.metrics.publicVotesAnalyzed || 0;
    if (score === null || score === undefined || analyzed === 0) return null;
    return perMonth(score, deputy.metrics.monthsInOffice);
  });
  const attendanceRates = deputies.map((deputy) =>
    perMonth(deputy.metrics.plenaryAttendances, deputy.metrics.monthsInOffice),
  );
  const voteRates = deputies.map((deputy) =>
    perMonth(deputy.metrics.nominalVotes, deputy.metrics.monthsInOffice),
  );

  const contributionPercentiles = percentileRanks(contributionRates);
  const efficiencyPercentiles = percentileRanks(efficiencyRates);
  const publicVotePercentiles = percentileRanks(publicVoteRates);
  const attendancePercentiles = percentileRanks(attendanceRates);
  const votePercentiles = percentileRanks(voteRates);

  const cfIndicators = deputies.map((deputy) =>
    campaignFinanceScore(deputy.metrics, deputy.assetsTotal),
  );
  const costPerVoteInverted = cfIndicators.map((i) =>
    i.costPerVote !== null ? 100 - i.costPerVote * 1000 : null,
  );
  const publicDependencyInverted = cfIndicators.map((i) =>
    i.publicDependency !== null ? 100 - i.publicDependency * 100 : null,
  );
  const donorConcInverted = cfIndicators.map((i) =>
    i.donorConcentration !== null ? 100 - i.donorConcentration * 100 : null,
  );
  const supplierConcInverted = cfIndicators.map((i) =>
    i.supplierConcentration !== null ? 100 - i.supplierConcentration * 100 : null,
  );
  const costPerVotePercentiles = percentileRanks(costPerVoteInverted);
  const publicDependencyPercentiles = percentileRanks(publicDependencyInverted);
  const donorConcPercentiles = percentileRanks(donorConcInverted);
  const supplierConcPercentiles = percentileRanks(supplierConcInverted);
  const patrimonyConsistencyPercentiles = percentileRanks(cfIndicators.map((i) => i.patrimonyConsistency));

  const scored = deputies.map<PublicValueRankedDeputy>((deputy, index) => {
    const contribution = contributionPercentiles[index];
    const efficiency = efficiencyPercentiles[index];
    const publicVotes = publicVotePercentiles[index];
    const attendance = attendancePercentiles[index];
    const votes = votePercentiles[index];
    const participation =
      attendance === null || votes === null ? null : (attendance + votes) / 2;

    let cfScoreSum = 0;
    let cfWeightSum = 0;
    const CF_W = CAMPAIGN_FINANCE_INDICATOR_WEIGHTS;
    if (costPerVotePercentiles[index] !== null) {
      cfScoreSum += costPerVotePercentiles[index]! * CF_W.costPerVote;
      cfWeightSum += CF_W.costPerVote;
    }
    if (publicDependencyPercentiles[index] !== null) {
      cfScoreSum += publicDependencyPercentiles[index]! * CF_W.publicDependency;
      cfWeightSum += CF_W.publicDependency;
    }
    if (donorConcPercentiles[index] !== null) {
      cfScoreSum += donorConcPercentiles[index]! * CF_W.donorConcentration;
      cfWeightSum += CF_W.donorConcentration;
    }
    if (supplierConcPercentiles[index] !== null) {
      cfScoreSum += supplierConcPercentiles[index]! * CF_W.supplierConcentration;
      cfWeightSum += CF_W.supplierConcentration;
    }
    if (patrimonyConsistencyPercentiles[index] !== null) {
      cfScoreSum += patrimonyConsistencyPercentiles[index]! * CF_W.patrimonyConsistency;
      cfWeightSum += CF_W.patrimonyConsistency;
    }
    const campaignFinance = cfWeightSum > 0 ? cfScoreSum / cfWeightSum : null;

    const eligible =
      deputy.metrics.monthsInOffice >= 3 &&
      contribution !== null &&
      publicVotes !== null &&
      efficiency !== null &&
      participation !== null;

    let scoreSum = 0;
    let weightSum = 0;
    if (contribution !== null) {
      scoreSum += contribution * PUBLIC_VALUE_WEIGHTS.contribution;
      weightSum += PUBLIC_VALUE_WEIGHTS.contribution;
    }
    if (publicVotes !== null) {
      scoreSum += publicVotes * PUBLIC_VALUE_WEIGHTS.publicVotes;
      weightSum += PUBLIC_VALUE_WEIGHTS.publicVotes;
    }
    if (efficiency !== null) {
      scoreSum += efficiency * PUBLIC_VALUE_WEIGHTS.efficiency;
      weightSum += PUBLIC_VALUE_WEIGHTS.efficiency;
    }
    if (participation !== null) {
      scoreSum += participation * PUBLIC_VALUE_WEIGHTS.participation;
      weightSum += PUBLIC_VALUE_WEIGHTS.participation;
    }
    if (campaignFinance !== null) {
      scoreSum += campaignFinance * PUBLIC_VALUE_WEIGHTS.campaignFinance;
      weightSum += PUBLIC_VALUE_WEIGHTS.campaignFinance;
    }
    const score = eligible && weightSum > 0
      ? scoreSum / weightSum
      : null;

    return {
      ...deputy,
      rank: null,
      eligible,
      score: score === null ? null : Math.round(score),
      dimensions: {
        contribution: contribution === null ? null : Math.round(contribution),
        publicVotes: publicVotes === null ? null : Math.round(publicVotes),
        efficiency: efficiency === null ? null : Math.round(efficiency),
        participation:
          participation === null ? null : Math.round(participation),
        campaignFinance:
          campaignFinance === null ? null : Math.round(campaignFinance),
      },
      labels: buildPublicValueLabels({
        contribution,
        publicVotes,
        efficiency,
        participation,
        campaignFinance,
        classified: deputy.metrics.publicClassifiedProposals || 0,
        total: deputy.metrics.publicTotalProposals || 0,
        analyzedVotes: deputy.metrics.publicVotesAnalyzed || 0,
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

function buildPublicValueLabels({
  contribution,
  publicVotes,
  efficiency,
  participation,
  campaignFinance,
  classified,
  total,
  analyzedVotes,
}: {
  contribution: number | null;
  publicVotes: number | null;
  efficiency: number | null;
  participation: number | null;
  campaignFinance: number | null;
  classified: number;
  total: number;
  analyzedVotes: number;
}) {
  const labels: string[] = [];
  if (efficiency !== null && efficiency >= 75) labels.push("Eficiente");
  if (contribution !== null && contribution >= 75) labels.push("Impacto alto");
  if (publicVotes !== null && publicVotes >= 75) labels.push("Votos de alto valor");
  if (publicVotes !== null && publicVotes <= 25) labels.push("Votos penalizados");
  if (participation !== null && participation >= 75) labels.push("Presente");
  if (participation !== null && participation <= 25) labels.push("Muitas ausências");
  if (contribution !== null && contribution <= 25) labels.push("Baixo retorno");
  if (total > 0 && classified / total < 0.5) labels.push("Classificação parcial");
  if (analyzedVotes === 0) labels.push("Votos sem análise");
  if (campaignFinance === null) labels.push("Cobertura de dados insuficiente");
  return labels.slice(0, 3);
}

function buildLabels({
  participation,
  production,
  resources,
  campaignFinance,
  concentration,
}: {
  participation: number | null;
  production: number | null;
  resources: number | null;
  campaignFinance: number | null;
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
  if (campaignFinance === null) labels.push("Cobertura de dados insuficiente");
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

export type PublicValueScoreBand =
  | "very-low"
  | "low"
  | "medium"
  | "high"
  | "excellent"
  | "unavailable";

export function publicValueScoreLabel(score: number | null) {
  const band = publicValueScoreBand(score);
  if (band === "excellent") return "Excelente";
  if (band === "high") return "Alto";
  if (band === "medium") return "Médio";
  if (band === "low") return "Baixo";
  if (band === "very-low") return "Muito baixo";
  return "Sem posição";
}

export function publicValueScoreBand(
  score: number | null,
): PublicValueScoreBand {
  if (score === null) return "unavailable";
  if (score >= 90) return "excellent";
  if (score >= 75) return "high";
  if (score >= 60) return "medium";
  if (score >= 40) return "low";
  return "very-low";
}
