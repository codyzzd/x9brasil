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
    totalVotes: 0,
    totalCampaignReceipts: null,
    totalPublicReceipts: null,
    totalCampaignExpenses: null,
    topDonors: [],
    topSuppliers: [],
    publicContributionPoints: 20,
  publicClassifiedProposals: 5,
  publicTotalProposals: 18,
  authorProposals: 8,
  coauthorProposals: 3,
  requesterProposals: 1,
  fiscalizationProposals: 2,
};

const deputy = {
  metrics,
  dimensions: {
    contribution: 96,
    efficiency: 95,
    participation: 98,
    campaignFinance: 40,
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
  assert.match(explanation.details[0], /10 pontos de produção/);
  assert.match(explanation.details[1], /Não usa presença ou votos/);
});

test("campaignFinance explanation shows campaign finance indicators", () => {
  const explanation = dimensionExplanation(
    deputy,
    "public-value",
    "campaignFinance",
  );
  assert.match(explanation.details[0], /Custo por voto/);
  assert.match(explanation.details[1], /Dependência de dinheiro público/);
  assert.match(explanation.details[2], /Doadores declarados/);
  assert.match(explanation.details[3], /Fornecedores declarados/);
});
