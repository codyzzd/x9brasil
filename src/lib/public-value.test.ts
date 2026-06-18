import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicVoteRecord,
  classifyPublicVote,
  classifyProposal,
  getProposalWeight,
  proposalContributionPoints,
  publicVoteScoreDelta,
  type ParticipationRole,
  type ProposalNature,
  type ProposalStage,
} from "./public-value";

test("classifies a single clear public-value theme", () => {
  const classification = classifyProposal(
    "example-health",
    "Amplia o acesso a medicamentos no Sistema Único de Saúde.",
  );
  assert.equal(classification?.category, "health");
  assert.equal(classification?.source, "rule");
});

test("keeps ambiguous multi-theme proposals pending", () => {
  const classification = classifyProposal(
    "example-ambiguous",
    "Cria programa de educação, saúde e segurança pública.",
  );
  assert.equal(classification, null);
});

test("stage changes contribution without changing category weight", () => {
  const classification = classifyProposal(
    "example-education",
    "Cria política nacional de educação básica.",
  );
  assert.ok(classification);
  assert.equal(proposalContributionPoints(classification, "presented"), 2);
  assert.equal(proposalContributionPoints(classification, "converted"), 8);
});

test("classifies clear public vote themes conservatively", () => {
  const transparency = classifyPublicVote(
    "vote-transparency",
    "Aprova projeto de transparência pública e dados abertos.",
    "",
  );
  assert.equal(transparency?.classification, "positive_public_interest");
  assert.equal(transparency?.publicInterestVote, "yes");

  const privilege = classifyPublicVote(
    "vote-privilege",
    "Aumenta verba parlamentar para benefícios da atividade política.",
    "",
  );
  assert.equal(privilege?.classification, "harmful_or_self_serving");
  assert.equal(privilege?.publicInterestVote, "no");

  const symbolic = classifyPublicVote(
    "vote-symbolic",
    "Denomina rodovia em homenagem a cidadão local.",
    "",
  );
  assert.equal(symbolic?.classification, "low_relevance");
});

test("scores public votes by alignment and absence severity", () => {
  const analysis = classifyPublicVote(
    "vote-control",
    "Aprova medidas de fiscalização e prestação de contas.",
    "",
  );
  assert.ok(analysis);
  assert.equal(publicVoteScoreDelta(analysis, "yes"), 18);
  assert.equal(publicVoteScoreDelta(analysis, "no"), -13);
  assert.equal(publicVoteScoreDelta(analysis, "abstain"), 0);
  assert.equal(publicVoteScoreDelta(analysis, "absent"), -4);
});

test("does not penalize low-confidence public vote analysis", () => {
  const record = buildPublicVoteRecord(
    {
      voteId: "manual-low-confidence",
      classification: "negative_public_interest",
      severity: "critical",
      publicInterestVote: "no",
      confidence: 0.5,
      reason: "Impacto pouco claro.",
      source: "reviewed",
      analysisLevel: 2,
      reviewedManually: true,
      methodologyVersion: "test",
    },
    123,
    "yes",
  );
  assert.equal(record.scoreDelta, 0);
});

test("getProposalWeight: author+substantive presented = 2 (base)", () => {
  const points = getProposalWeight({
    categoryWeight: 2,
    stageMultiplier: 1,
    role: "AUTHOR" as ParticipationRole,
    nature: "SUBSTANTIVE" as ProposalNature,
    stage: "presented" as ProposalStage,
  });
  assert.equal(points, 2);
});

test("getProposalWeight: coauthor+substantive = 0.9 (2 × 1 × 0.45 × 1)", () => {
  const points = getProposalWeight({
    categoryWeight: 2,
    stageMultiplier: 1,
    role: "COAUTHOR" as ParticipationRole,
    nature: "SUBSTANTIVE" as ProposalNature,
    stage: "presented" as ProposalStage,
  });
  assert.equal(points, 0.9);
});

test("getProposalWeight: requester+fiscalization = 0.78 (2 × 1 × 0.60 × 0.65)", () => {
  const points = getProposalWeight({
    categoryWeight: 2,
    stageMultiplier: 1,
    role: "REQUESTER" as ParticipationRole,
    nature: "FISCALIZATION" as ProposalNature,
    stage: "presented" as ProposalStage,
  });
  assert.equal(points, 0.78);
});

test("getProposalWeight: symbolic nature = 0.2 (2 × 1 × 1 × 0.10)", () => {
  const points = getProposalWeight({
    categoryWeight: 2,
    stageMultiplier: 1,
    role: "AUTHOR" as ParticipationRole,
    nature: "SYMBOLIC" as ProposalNature,
    stage: "presented" as ProposalStage,
  });
  assert.equal(points, 0.2);
});

test("getProposalWeight: unknown role+nature = 0.005 (2 × 1 × 0.05 × 0.05)", () => {
  const points = getProposalWeight({
    categoryWeight: 2,
    stageMultiplier: 1,
    role: "UNKNOWN" as ParticipationRole,
    nature: "UNKNOWN" as ProposalNature,
    stage: "presented" as ProposalStage,
  });
  assert.ok(Math.abs(points - 0.005) < 1e-9);
});

test("getProposalWeight: author+substantive+converted = 7.7 (2 × 3.6 × 1 × 1 + 0.5)", () => {
  const points = getProposalWeight({
    categoryWeight: 2,
    stageMultiplier: 3.6,
    role: "AUTHOR" as ParticipationRole,
    nature: "SUBSTANTIVE" as ProposalNature,
    stage: "converted" as ProposalStage,
  });
  assert.equal(points, 7.7);
});

test("getProposalWeight: author+substantive+advanced = 2.2 (2 × 1 × 1 × 1 + 0.2)", () => {
  const points = getProposalWeight({
    categoryWeight: 2,
    stageMultiplier: 1,
    role: "AUTHOR" as ParticipationRole,
    nature: "SUBSTANTIVE" as ProposalNature,
    stage: "advanced" as ProposalStage,
  });
  assert.equal(points, 2.2);
});
