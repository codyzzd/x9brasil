import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicVoteRecord,
  classifyPublicVote,
  classifyProposal,
  proposalContributionPoints,
  publicVoteScoreDelta,
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
      reviewedManually: true,
      methodologyVersion: "test",
    },
    123,
    "yes",
  );
  assert.equal(record.scoreDelta, 0);
});
