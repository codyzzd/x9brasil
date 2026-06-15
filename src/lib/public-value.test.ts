import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProposal,
  proposalContributionPoints,
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
