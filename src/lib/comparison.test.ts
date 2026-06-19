import assert from "node:assert/strict";
import test from "node:test";
import {
  buildComparisonCandidate,
  calculateComparisonDifference,
} from "./comparison";
import {
  calculatePublicValueRanking,
  calculateRanking,
  type DeputyRecord,
  type ProfileIdentityDetails,
  type ProfilePeriodDetails,
} from "./ranking";

const record: DeputyRecord = {
  id: 1,
  slug: "deputada-1",
  name: "Deputada 1",
  civilName: "Deputada Civil 1",
  party: "ABC",
  state: "CE",
  photoUrl: "",
  chamberUrl: "",
  electionNumber: "1234",
  tseSequence: null,
  electionStatus: null,
  assetsTotal: 200_000,
  assetsCount: 2,
  officeStart: "2023-02-01",
  officeEnd: "2026-06-15",
  daysInOffice: 1_230,
  metrics: {
    monthsInOffice: 5,
    plenaryAttendances: 20,
    nominalVotes: 30,
    substantiveProposals: 4,
    oversightProposals: 2,
    advancedProposals: 1,
    convertedProposals: 0,
    expensesTotal: 100_000,
    expenseDocuments: 10,
    supplierConcentration: 0.25,
    campaignCandidacyAvailable: true,
    assetsAvailable: true,
    totalVotes: 0,
    totalCampaignReceipts: 100_000,
    totalPublicReceipts: 50_000,
    totalCampaignExpenses: 80_000,
    topDonors: [],
    topSuppliers: [],
    publicContributionPoints: 12,
    publicClassifiedProposals: 2,
    publicTotalProposals: 2,
    authorProposals: 4,
    coauthorProposals: 2,
    requesterProposals: 1,
    fiscalizationProposals: 2,
    publicVotePositivePoints: 12,
    publicVoteNegativePenalties: 2,
    publicVoteAbsencePenalties: 0,
    publicVotesAnalyzed: 3,
    publicVoteAverageConfidence: 0.8,
    publicVoteScore: 10,
  },
};

const identity: ProfileIdentityDetails = {
  id: 1,
  birthDate: null,
  birthPlace: null,
  education: null,
  office: null,
  staff: [
    { name: "A", role: "Secretário", startDate: null },
    { name: "B", role: "Secretário", startDate: null },
  ],
  assets: [],
};

const period: ProfilePeriodDetails = {
  id: 1,
  expenseCategories: [
    { name: "Menor categoria", total: 10_000, documents: 2 },
    { name: "Maior categoria", total: 90_000, documents: 8 },
  ],
  suppliers: [
    { name: "Fornecedor menor", taxId: null, total: 20_000, documents: 2 },
    { name: "Fornecedor maior", taxId: null, total: 80_000, documents: 8 },
  ],
  largestExpenses: [],
  proposals: [],
  campaignDonors: [],
  campaignSuppliers: [],
  amendments: [
    {
      number: "1",
      year: "2026",
      type: "Individual",
      beneficiary: "Município A",
      proposedValue: 1_000_000,
      transferredValue: 400_000,
    },
    {
      number: "2",
      year: "2026",
      type: "Individual",
      beneficiary: "Município B",
      proposedValue: 500_000,
      transferredValue: 100_000,
    },
  ],
};

test("comparison preserves the current ranking score and dimensions", () => {
  const ranked = calculateRanking([record])[0];
  const comparison = buildComparisonCandidate(ranked, "current", {
    identity,
    period,
  });

  assert.equal(comparison.score, ranked.score);
  assert.equal(comparison.rank, ranked.rank);
  assert.deepEqual(
    comparison.dimensions.map(({ value }) => value),
    [
      ranked.dimensions.participation,
      ranked.dimensions.production,
      ranked.dimensions.resources,
      ranked.dimensions.campaignFinance,
    ],
  );
});

test("comparison preserves the public value ranking score and dimensions", () => {
  const ranked = calculatePublicValueRanking([record])[0];
  const comparison = buildComparisonCandidate(ranked, "public-value", {
    identity,
    period,
  });

  assert.equal(comparison.score, ranked.score);
  assert.equal(comparison.rank, ranked.rank);
  assert.deepEqual(
    comparison.dimensions.map(({ value }) => value),
    [
      ranked.dimensions.participation,
      ranked.dimensions.contribution,
      ranked.dimensions.publicVotes,
      ranked.dimensions.efficiency,
      ranked.dimensions.campaignFinance,
    ],
  );
});

test("comparison derives monthly expenses, amendment totals and current staff", () => {
  const comparison = buildComparisonCandidate(
    calculateRanking([record])[0],
    "current",
    { identity, period },
  );

  assert.equal(comparison.expenses.monthlyAverage, 20_000);
  assert.equal(comparison.expenses.topCategory, "Maior categoria");
  assert.equal(comparison.expenses.topSupplier, "Fornecedor maior");
  assert.deepEqual(comparison.amendments, {
    count: 2,
    proposedValue: 1_500_000,
    transferredValue: 500_000,
  });
  assert.equal(comparison.staffCount, 2);
});

test("difference is symmetric and uses the average magnitude", () => {
  assert.deepEqual(calculateComparisonDifference(150, 100), {
    absolute: 50,
    percent: 40,
  });
  assert.deepEqual(
    calculateComparisonDifference(100, 150),
    calculateComparisonDifference(150, 100),
  );
});

test("difference handles zero and unavailable values without invalid division", () => {
  assert.deepEqual(calculateComparisonDifference(0, 0), {
    absolute: 0,
    percent: null,
  });
  assert.equal(calculateComparisonDifference(null, 10), null);
});
