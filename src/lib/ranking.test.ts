import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRanking,
  filterRankingCohort,
  percentileRanks,
  SCORE_WEIGHTS,
  searchRankedDeputies,
  scoreBand,
  type DeputyRecord,
} from "./ranking";

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
    campaignReceiptsAvailable: true,
    campaignExpensesAvailable: true,
    accountsStatusAvailable: true,
    ...overrides,
  },
});

test("uses equal weights for all score dimensions", () => {
  assert.deepEqual(SCORE_WEIGHTS, {
    participation: 0.25,
    production: 0.25,
    resources: 0.25,
    transparency: 0.25,
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

test("score bands follow the traffic-light thresholds", () => {
  assert.equal(scoreBand(null), "unavailable");
  assert.equal(scoreBand(49), "low");
  assert.equal(scoreBand(50), "medium");
  assert.equal(scoreBand(64), "medium");
  assert.equal(scoreBand(65), "good");
});
