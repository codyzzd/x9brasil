import assert from "node:assert/strict";
import test from "node:test";
import {
  dimensionExplanation,
  publicValueEfficiencyPerHundredThousand,
} from "./dimension-explanations";
import type { PublicValueRankedDeputy, RawMetrics } from "./ranking";

const metrics: RawMetrics = {
  monthsInOffice: 5,
  plenaryAttendances: 44,
  nominalVotes: 120,
  substantiveProposals: 10,
  oversightProposals: 2,
  advancedProposals: 4,
  convertedProposals: 1,
  expensesTotal: 200_000,
  expenseDocuments: 30,
  supplierConcentration: 0.2,
  campaignCandidacyAvailable: true,
  assetsAvailable: true,
  campaignReceiptsAvailable: false,
  campaignExpensesAvailable: false,
  accountsStatusAvailable: false,
  publicContributionPoints: 20,
  publicClassifiedProposals: 5,
  publicTotalProposals: 18,
};

const deputy = {
  metrics,
  dimensions: {
    contribution: 96,
    efficiency: 95,
    participation: 98,
    transparency: 40,
  },
} as PublicValueRankedDeputy;

test("calculates contribution points per R$ 100 thousand", () => {
  assert.equal(publicValueEfficiencyPerHundredThousand(metrics), 10);
});

test("efficiency explanation separates efficiency from participation", () => {
  const explanation = dimensionExplanation(
    deputy,
    "public-value",
    "efficiency",
  );
  assert.match(explanation.details[0], /10 pontos de contribuição/);
  assert.match(explanation.details[1], /Não usa presença ou votos/);
});

test("transparency explanation lists available and missing blocks", () => {
  const explanation = dimensionExplanation(
    deputy,
    "public-value",
    "transparency",
  );
  assert.match(explanation.details[0], /2\/5 disponíveis/);
  assert.match(explanation.details[1], /Receitas eleitorais/);
  assert.match(explanation.details[1], /Situação das contas/);
});
