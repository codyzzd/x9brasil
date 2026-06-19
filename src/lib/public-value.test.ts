import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicVoteRecord,
  classifyPublicVote,
  classifyProposal,
  getProposalWeight,
  normalizeVoteAnalysis,
  proposalContributionPoints,
  publicVoteScoreDelta,
  type ParticipationRole,
  type ProposalNature,
  type ProposalStage,
  type PublicVoteAnalysis,
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
  assert.equal(publicVoteScoreDelta(analysis, "yes"), 13);
  assert.equal(publicVoteScoreDelta(analysis, "no"), -13);
  assert.equal(publicVoteScoreDelta(analysis, "abstain"), 0);
  assert.equal(publicVoteScoreDelta(analysis, "absent"), 0);
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

function voteFixture(overrides: Partial<PublicVoteAnalysis> = {}): PublicVoteAnalysis {
  return normalizeVoteAnalysis({
    voteId: "fixture",
    classification: "positive_public_interest",
    severity: "high",
    publicInterestVote: "yes",
    confidence: 0.9,
    isProceduralVote: false,
    legislativeType: "PL",
    decisionNature: "substantive_policy",
    decisionScope: "national_policy",
    voteObjectType: "main_bill",
    analyzedTextMatchesVoteObject: "true",
    scoreImpactLimit: "high",
    netPublicEffect: "positive",
    riskFlags: ["none"],
    criticalArticles: [],
    reason: "Impacto público claro.",
    source: "llm",
    analysisLevel: 3,
    reviewedManually: false,
    methodologyVersion: "legislative-impact-v2",
    ...overrides,
  });
}

test("limits apparent benefit with hidden workload cost", () => {
  const analysis = voteFixture({
    classification: "negative_public_interest",
    publicInterestVote: "no",
    netPublicEffect: "negative",
    declaredBenefit: "Reduz dias trabalhados.",
    hiddenCost: "Permite aumento da jornada diária.",
    riskFlags: ["benefit_offset_by_hidden_cost", "increased_workload"],
  });
  assert.equal(analysis.netPublicEffect, "negative");
  assert.ok(analysis.riskFlags?.includes("benefit_offset_by_hidden_cost"));
  assert.equal(publicVoteScoreDelta(analysis, "no"), 9);
});

test("does not treat vote against amendment as vote against whole bill when object text is unclear", () => {
  const analysis = voteFixture({
    voteObjectType: "amendment",
    analyzedTextMatchesVoteObject: "unclear",
    scoreImpactLimit: "low",
    confidence: 0.6,
    riskFlags: ["unrelated_amendment"],
  });
  assert.equal(publicVoteScoreDelta(analysis, "no"), -3);
});

test("keeps urgency request procedural and low impact", () => {
  const analysis = voteFixture({
    classification: "neutral",
    publicInterestVote: "none",
    isProceduralVote: true,
    voteObjectType: "urgency",
    scoreImpactLimit: "low",
    riskFlags: ["procedural_only"],
  });
  assert.equal(publicVoteScoreDelta(analysis, "yes"), 0);
});

test("caps RIC/PFC-style oversight impact at medium", () => {
  const analysis = voteFixture({
    legislativeType: "RIC",
    decisionNature: "information_request",
    decisionScope: "oversight",
    severity: "high",
    scoreImpactLimit: "medium",
  });
  assert.equal(publicVoteScoreDelta(analysis, "yes"), 8);
});

test("keeps PEC without full text uncertain and low confidence", () => {
  const analysis = voteFixture({
    legislativeType: "PEC",
    confidence: 0.6,
    scoreImpactLimit: "low",
    netPublicEffect: "unclear",
    riskFlags: ["insufficient_text"],
  });
  assert.equal(publicVoteScoreDelta(analysis, "yes"), 3);
});

test("zeros score when analyzed text does not match vote object", () => {
  const analysis = voteFixture({
    analyzedTextMatchesVoteObject: "false",
    riskFlags: ["text_does_not_match_vote_object"],
  });
  assert.equal(publicVoteScoreDelta(analysis, "yes"), 0);
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
