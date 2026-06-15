import type {
  ProfileIdentityDetails,
  ProfilePeriodDetails,
  PublicValueRankedDeputy,
  RankedDeputy,
  RankingIndex,
} from "@/lib/ranking";

export type ComparisonDifference = {
  absolute: number;
  percent: number | null;
};

export type ComparisonCandidate = {
  id: number;
  slug: string;
  name: string;
  civilName: string;
  photoUrl: string;
  party: string;
  state: string;
  officeStart: string;
  score: number | null;
  rank: number | null;
  dimensions: Array<{
    key: string;
    label: string;
    value: number | null;
  }>;
  activity: {
    plenaryAttendances: number | null;
    nominalVotes: number | null;
    substantiveProposals: number | null;
    oversightProposals: number | null;
    advancedProposals: number | null;
    convertedProposals: number | null;
  };
  expenses: {
    total: number | null;
    documents: number | null;
    monthlyAverage: number | null;
    supplierConcentration: number | null;
    topCategory: string | null;
    topSupplier: string | null;
  };
  amendments: {
    count: number;
    proposedValue: number;
    transferredValue: number;
  };
  assets: {
    total: number | null;
    count: number | null;
  };
  staffCount: number | null;
};

export function buildComparisonCandidate(
  ranked: RankedDeputy | PublicValueRankedDeputy,
  index: RankingIndex,
  profile: {
    identity: ProfileIdentityDetails | null;
    period: ProfilePeriodDetails | null;
  },
): ComparisonCandidate {
  const amendments = profile.period?.amendments || [];
  const months = ranked.metrics.monthsInOffice;

  return {
    id: ranked.id,
    slug: ranked.slug,
    name: ranked.name,
    civilName: ranked.civilName,
    photoUrl: ranked.photoUrl,
    party: ranked.party,
    state: ranked.state,
    officeStart: ranked.officeStart,
    score: ranked.score,
    rank: ranked.rank,
    dimensions:
      index === "public-value" && "contribution" in ranked.dimensions
        ? [
            {
              key: "contribution",
              label: "Contribuição pública",
              value: ranked.dimensions.contribution,
            },
            {
              key: "publicVotes",
              label: "Votos públicos",
              value: ranked.dimensions.publicVotes,
            },
            {
              key: "efficiency",
              label: "Eficiência financeira",
              value: ranked.dimensions.efficiency,
            },
            {
              key: "participation",
              label: "Participação",
              value: ranked.dimensions.participation,
            },
            {
              key: "transparency",
              label: "Transparência",
              value: ranked.dimensions.transparency,
            },
          ]
        : "production" in ranked.dimensions
          ? [
              {
                key: "participation",
                label: "Participação",
                value: ranked.dimensions.participation,
              },
              {
                key: "production",
                label: "Produção",
                value: ranked.dimensions.production,
              },
              {
                key: "resources",
                label: "Uso de recursos",
                value: ranked.dimensions.resources,
              },
              {
                key: "transparency",
                label: "Transparência",
                value: ranked.dimensions.transparency,
              },
            ]
          : [],
    activity: {
      plenaryAttendances: ranked.metrics.plenaryAttendances,
      nominalVotes: ranked.metrics.nominalVotes,
      substantiveProposals: ranked.metrics.substantiveProposals,
      oversightProposals: ranked.metrics.oversightProposals,
      advancedProposals: ranked.metrics.advancedProposals,
      convertedProposals: ranked.metrics.convertedProposals,
    },
    expenses: {
      total: ranked.metrics.expensesTotal,
      documents: ranked.metrics.expenseDocuments,
      monthlyAverage:
        ranked.metrics.expensesTotal === null || months <= 0
          ? null
          : ranked.metrics.expensesTotal / months,
      supplierConcentration: ranked.metrics.supplierConcentration,
      topCategory: greatestByTotal(profile.period?.expenseCategories)?.name || null,
      topSupplier: greatestByTotal(profile.period?.suppliers)?.name || null,
    },
    amendments: {
      count: amendments.length,
      proposedValue: amendments.reduce(
        (sum, amendment) => sum + amendment.proposedValue,
        0,
      ),
      transferredValue: amendments.reduce(
        (sum, amendment) => sum + amendment.transferredValue,
        0,
      ),
    },
    assets: {
      total: ranked.assetsTotal,
      count: ranked.assetsCount,
    },
    staffCount: profile.identity ? profile.identity.staff.length : null,
  };
}

export function calculateComparisonDifference(
  left: number | null,
  right: number | null,
): ComparisonDifference | null {
  if (left === null || right === null) return null;

  const absolute = Math.abs(left - right);
  const averageMagnitude = (Math.abs(left) + Math.abs(right)) / 2;

  return {
    absolute,
    percent:
      averageMagnitude === 0 ? null : (absolute / averageMagnitude) * 100,
  };
}

function greatestByTotal<T extends { total: number }>(rows?: T[]) {
  if (!rows?.length) return null;
  return rows.reduce((greatest, row) =>
    row.total > greatest.total ? row : greatest,
  );
}
