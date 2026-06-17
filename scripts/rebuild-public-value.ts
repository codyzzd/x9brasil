import { readFile, writeFile } from "node:fs/promises";
import {
  NATURE_WEIGHTS,
  PROGRESS_BONUS,
  PUBLIC_VALUE_CATEGORIES,
  ROLE_WEIGHTS,
  classifyProposal,
  proposalContributionPoints,
  proposalStageMultiplier,
  type ProposalStage,
} from "../src/lib/public-value";
import type {
  ProfileDetailsSnapshot,
  ProfilePeriodDetails,
  RankingSnapshot,
} from "../src/lib/ranking";

const rankingUrl = new URL("../.data/ranking-snapshot.json", import.meta.url);
const profileUrl = new URL("../.data/profile-details.json", import.meta.url);

function inferStage(status: string): ProposalStage {
  const normalized = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  if (/transformad|convertid/.test(normalized) && /norma|lei/.test(normalized)) {
    return "converted";
  }
  if (/apresentacao de proposicao|recebimento/.test(normalized)) {
    return "presented";
  }
  return "advanced";
}

function enrichPeriod(period: ProfilePeriodDetails) {
  let points = 0;
  let classified = 0;
  period.proposals = period.proposals.map((proposal) => {
    const classification = classifyProposal(proposal.id, proposal.summary);
    if (!classification) return { ...proposal, publicValue: null };
    const stage = inferStage(proposal.status);
    const category = PUBLIC_VALUE_CATEGORIES[classification.category];
    const proposalPoints = proposalContributionPoints(classification, stage);
    points += proposalPoints;
    classified += 1;
    return {
      ...proposal,
      publicValue: {
        category: classification.category,
        categoryLabel: category.label,
        categoryWeight: category.weight,
        confidence: classification.confidence,
        justification: classification.justification,
        source: classification.source,
        stage,
        stageMultiplier: proposalStageMultiplier(stage),
        points: proposalPoints,
        methodologyVersion: classification.methodologyVersion,
        roleWeight: 1,
        natureWeight: 1,
        progressBonus:
          stage === "converted"
            ? PROGRESS_BONUS.BECAME_NORM
            : stage === "advanced"
              ? PROGRESS_BONUS.ADVANCED
              : 0,
        scoreExplanation: "",
      },
    };
  });
  return { points, classified, proposals: period.proposals };
}

async function main() {
  const ranking = JSON.parse(
    await readFile(rankingUrl, "utf8"),
  ) as RankingSnapshot;
  const profiles = JSON.parse(
    await readFile(profileUrl, "utf8"),
  ) as ProfileDetailsSnapshot;
  const aggregates = new Map<
    string,
    { points: number; classified: number; proposals: Map<string, unknown> }
  >();

  for (const period of profiles.periods) {
    for (const deputy of period.deputies) {
      const result = enrichPeriod(deputy);
      aggregates.set(`${period.id}:${deputy.id}`, {
        points: result.points,
        classified: result.classified,
        proposals: new Map(
          result.proposals.map((proposal) => [proposal.id, proposal]),
        ),
      });
      const legislatureKey = `legislature:${deputy.id}`;
      const legislature = aggregates.get(legislatureKey) || {
        points: 0,
        classified: 0,
        proposals: new Map<string, unknown>(),
      };
      for (const proposal of result.proposals) {
        if (legislature.proposals.has(proposal.id)) continue;
        legislature.proposals.set(proposal.id, proposal);
        if (proposal.publicValue) {
          legislature.points += proposal.publicValue.points;
          legislature.classified += 1;
        }
      }
      aggregates.set(legislatureKey, legislature);
    }
  }

  for (const period of ranking.periods) {
    for (const deputy of period.deputies) {
      const aggregate = aggregates.get(`${period.id}:${deputy.id}`);
      const total =
        (deputy.metrics.substantiveProposals || 0) +
        (deputy.metrics.oversightProposals || 0);
      deputy.metrics.publicContributionPoints =
        aggregate && aggregate.classified > 0
          ? Number(aggregate.points.toFixed(2))
          : null;
      deputy.metrics.publicClassifiedProposals = aggregate?.classified || 0;
      deputy.metrics.publicTotalProposals = total;
    }
  }

  await writeFile(rankingUrl, `${JSON.stringify(ranking, null, 2)}\n`);
  await writeFile(profileUrl, `${JSON.stringify(profiles)}\n`);

  console.log(
    `Valor público reconstruído para ${ranking.periods.length} períodos usando o snapshot existente`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
