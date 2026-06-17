import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePublicValueRanking,
  calculateRanking,
  calculateRankChanges,
  comparisonPeriod,
  filterRankingCohort,
  materializePeriod,
  percentileRanks,
  publicValueScoreBand,
  SCORE_WEIGHTS,
  searchRankedDeputies,
  scoreBand,
  type DeputyRecord,
  type RankingSnapshot,
} from "./ranking";
import { PUBLIC_VALUE_WEIGHTS } from "./public-value";

const deputy = (
  id: number,
  overrides: Partial<DeputyRecord["metrics"]> = {},
): DeputyRecord => ({
  id,
  slug: `deputado-${id}`,
  name: `Deputado ${id}`,
  civilName: `Deputado Civil ${id}`,
  party: id % 2 ? "A" : "B",
  state: id <= 2 ? "CE" : "SP",
  photoUrl: "",
  chamberUrl: "",
  electionNumber: null,
  tseSequence: null,
  electionStatus: null,
  assetsTotal: null,
  assetsCount: null,
  officeStart: "2023-02-01",
  officeEnd: "2023-12-31",
  daysInOffice: 334,
  metrics: {
    monthsInOffice: 40,
    plenaryAttendances: id * 10,
    nominalVotes: id * 20,
    substantiveProposals: id * 3,
    oversightProposals: id,
    advancedProposals: id * 2,
    convertedProposals: 0,
    expensesTotal: id * 100_000,
    expenseDocuments: id * 10,
    supplierConcentration: 0.2,
    campaignCandidacyAvailable: true,
    assetsAvailable: true,
    totalVotes: 0,
    totalCampaignReceipts: 100_000,
    totalPublicReceipts: 50_000,
    totalCampaignExpenses: 80_000,
    topDonors: [],
    topSuppliers: [],
    publicVotePositivePoints: id * 8,
    publicVoteNegativePenalties: id,
    publicVoteAbsencePenalties: 0,
    publicVotesAnalyzed: 3,
    publicVoteAverageConfidence: 0.8,
    publicVoteScore: id * 7,
    authorProposals: id * 2,
    coauthorProposals: id,
    requesterProposals: id,
    fiscalizationProposals: id,
    ...overrides,
  },
});

test("uses conservative weights for all score dimensions", () => {
  assert.deepEqual(SCORE_WEIGHTS, {
    participation: 0.30,
    production: 0.30,
    resources: 0.30,
    campaignFinance: 0.10,
  });
});

test("public value index uses conservative campaign finance weight", () => {
  assert.deepEqual(PUBLIC_VALUE_WEIGHTS, {
    contribution: 0.30,
    publicVotes: 0.25,
    efficiency: 0.20,
    participation: 0.15,
    campaignFinance: 0.10,
  });
});

test("percentiles preserve ties", () => {
  assert.deepEqual(percentileRanks([10, 20, 20, 30]), [0, 50, 50, 100]);
});

test("ranking is recalculated for the supplied cohort", () => {
  const national = calculateRanking([deputy(1), deputy(2), deputy(3)]);
  const ceara = calculateRanking([deputy(1), deputy(2)]);
  assert.equal(national.find((item) => item.id === 2)?.rank, 2);
  assert.equal(ceara.find((item) => item.id === 2)?.rank, 1);
});

test("state and party define the comparison cohort", () => {
  const source = [deputy(1), deputy(2), deputy(3)];
  assert.deepEqual(
    filterRankingCohort(source, "CE", "B").map((item) => item.id),
    [2],
  );
});

test("text search preserves scores and positions already calculated", () => {
  const ranked = calculateRanking([deputy(1), deputy(2), deputy(3)]);
  const before = ranked.find((item) => item.id === 2);
  const result = searchRankedDeputies(ranked, "Deputado 2");
  assert.equal(result.length, 1);
  assert.equal(result[0].rank, before?.rank);
  assert.equal(result[0].score, before?.score);
});

test("deputies with less than 90 days have no position", () => {
  const result = calculateRanking([
    deputy(1, { monthsInOffice: 2 }),
    deputy(2),
  ]);
  const shortMandate = result.find((item) => item.id === 1);
  assert.equal(shortMandate?.eligible, false);
  assert.equal(shortMandate?.rank, null);
  assert.equal(shortMandate?.score, null);
});

test("missing metrics are not converted to zero", () => {
  const result = calculateRanking([
    deputy(1, { nominalVotes: null }),
    deputy(2),
  ]);
  assert.equal(result.find((item) => item.id === 1)?.score, null);
});

test("unclassified proposals do not become zero contribution", () => {
  const result = calculatePublicValueRanking([
    deputy(1, {
      publicContributionPoints: null,
      publicClassifiedProposals: 0,
      publicTotalProposals: 4,
    }),
    deputy(2, {
      publicContributionPoints: 10,
      publicClassifiedProposals: 2,
      publicTotalProposals: 2,
    }),
  ]);
  const pending = result.find((item) => item.id === 1);
  assert.equal(pending?.dimensions.contribution, null);
  assert.equal(pending?.score, null);
});

test("unanalyzed public votes do not become zero public-vote score", () => {
  const result = calculatePublicValueRanking([
    deputy(1, {
      publicContributionPoints: 10,
      publicClassifiedProposals: 2,
      publicTotalProposals: 2,
      publicVoteScore: null,
      publicVotesAnalyzed: 0,
    }),
    deputy(2, {
      publicContributionPoints: 10,
      publicClassifiedProposals: 2,
      publicTotalProposals: 2,
    }),
  ]);
  const pending = result.find((item) => item.id === 1);
  assert.equal(pending?.dimensions.publicVotes, null);
  assert.equal(pending?.score, null);
});

test("public value ranking rewards more contribution per expense", () => {
  const result = calculatePublicValueRanking([
    deputy(1, {
      publicContributionPoints: 20,
      publicClassifiedProposals: 2,
      publicTotalProposals: 2,
      expensesTotal: 100_000,
    }),
    deputy(2, {
      publicContributionPoints: 20,
      publicClassifiedProposals: 2,
      publicTotalProposals: 2,
      expensesTotal: 300_000,
    }),
  ]);
  const efficient = result.find((item) => item.id === 1);
  const expensive = result.find((item) => item.id === 2);
  assert.ok(
    (efficient?.dimensions.efficiency ?? 0) >
      (expensive?.dimensions.efficiency ?? 0),
  );
});

test("score bands follow the traffic-light thresholds", () => {
  assert.equal(scoreBand(null), "unavailable");
  assert.equal(scoreBand(49), "low");
  assert.equal(scoreBand(50), "medium");
  assert.equal(scoreBand(64), "medium");
  assert.equal(scoreBand(65), "good");
});

test("public value bands follow the five experimental thresholds", () => {
  assert.equal(publicValueScoreBand(null), "unavailable");
  assert.equal(publicValueScoreBand(39), "very-low");
  assert.equal(publicValueScoreBand(40), "low");
  assert.equal(publicValueScoreBand(60), "medium");
  assert.equal(publicValueScoreBand(75), "high");
  assert.equal(publicValueScoreBand(90), "excellent");
});

test("materializes identities with metrics from the selected period", () => {
  const record = deputy(1);
  const snapshot: RankingSnapshot = {
    version: 2,
    generatedAt: "2026-06-15T00:00:00.000Z",
    timezone: "America/Fortaleza",
    defaultPeriod: "2026",
    sources: [],
    deputies: [
      {
        id: record.id,
        slug: record.slug,
        name: record.name,
        civilName: record.civilName,
        photoUrl: record.photoUrl,
        chamberUrl: record.chamberUrl,
        electionNumber: record.electionNumber,
        tseSequence: record.tseSequence,
        electionStatus: record.electionStatus,
        assetsTotal: record.assetsTotal,
        assetsCount: record.assetsCount,
      },
    ],
    periods: [
      {
        id: "2026",
        label: "2026",
        start: "2026-01-01",
        end: "2026-06-15",
        partial: true,
        deputies: [
          {
            id: record.id,
            party: record.party,
            state: record.state,
            officeStart: record.officeStart,
            officeEnd: record.officeEnd,
            daysInOffice: record.daysInOffice,
            metrics: record.metrics,
          },
        ],
      },
    ],
  };
  assert.equal(materializePeriod(snapshot, "2026")[0].name, record.name);
  assert.equal(materializePeriod(snapshot, "2026")[0].party, record.party);
});

test("rank change is positive when the deputy moves up", () => {
  const previousDeputy = calculateRanking([deputy(1), deputy(2)])[0];
  const currentDeputy = calculateRanking([deputy(1), deputy(2)])[0];
  const previous = [{ ...previousDeputy, rank: 8 }];
  const current = [{ ...currentDeputy, rank: 3 }];
  const changes = calculateRankChanges(current, previous, "2025");
  assert.equal(changes.get(currentDeputy.id)?.delta, 5);
});

test("long comparison uses the first available year before the selected period", () => {
  const snapshot = {
    defaultPeriod: "2026",
    periods: [
      { id: "2023" },
      { id: "2024" },
      { id: "2025" },
      { id: "2026" },
      { id: "legislature" },
    ],
  } as RankingSnapshot;

  assert.equal(
    comparisonPeriod(snapshot, "2026", "legislature-start")?.id,
    "2023",
  );
  assert.equal(
    comparisonPeriod(snapshot, "2026", "previous-year")?.id,
    "2025",
  );
});
