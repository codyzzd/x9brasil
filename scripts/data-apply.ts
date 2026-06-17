import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import {
  NATURE_WEIGHTS,
  PROGRESS_BONUS,
  PUBLIC_VALUE_CATEGORIES,
  ROLE_WEIGHTS,
  buildPublicVoteRecord,
  classifyProposal,
  classifyPublicVote,
  getProposalWeight,
  normalizePublicVote,
  proposalStageMultiplier,
  publicValueClassificationMetadata,
  type CandidateVote,
  type ParticipationRole,
  type ProposalNature,
  type ProposalStage,
  type PublicVoteAnalysis,
} from "../src/lib/public-value";
import type {
  PeriodDeputyRecord,
  ProfileDetailsSnapshot,
  ProfilePeriodDetails,
  RankingSnapshot,
} from "../src/lib/ranking";

const RANKING_PATH = new URL("../.data/ranking-snapshot.json", import.meta.url);
const PROFILE_PATH = new URL("../.data/profile-details.json", import.meta.url);
const PENDING_PATH = new URL("../.data/public-value-classification-pending.json", import.meta.url);
const BANNER_PATH = new URL("../.data/banner-metadata.json", import.meta.url);

function inferStage(status: string): ProposalStage {
  const normalized = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  if (/transformad|convertid/.test(normalized) && /norma|lei/.test(normalized)) return "converted";
  if (/apresentacao de proposicao|recebimento/.test(normalized)) return "presented";
  return "advanced";
}

async function main() {
  const startTime = performance.now();
  console.log("Aplicando classificações nos dados existentes...\n");

  const ranking = JSON.parse(await readFile(RANKING_PATH, "utf8")) as RankingSnapshot;
  const profiles = JSON.parse(await readFile(PROFILE_PATH, "utf8")) as ProfileDetailsSnapshot;

  let proposalsReclassified = 0;
  let votesReclassified = 0;

  for (const period of profiles.periods) {
    for (const deputy of period.deputies) {
      for (const proposal of deputy.proposals) {
        const classification = classifyProposal(proposal.id, proposal.summary);
        if (!classification) {
          proposal.publicValue = null;
          continue;
        }
        proposalsReclassified++;
        const existingStage = proposal.publicValue?.stage;
        const stage = (existingStage || inferStage(proposal.status)) as ProposalStage;
        const category = PUBLIC_VALUE_CATEGORIES[classification.category];
        const stageMultiplier = proposalStageMultiplier(stage);
        const role = (proposal.participationRole || "COAUTHOR") as ParticipationRole;
        const nature = (proposal.proposalNature || "SUBSTANTIVE") as ProposalNature;
        const weight = getProposalWeight({
          categoryWeight: category.weight,
          stageMultiplier,
          role,
          nature,
          stage,
        });
        proposal.publicValue = {
          category: classification.category,
          categoryLabel: category.label,
          categoryWeight: category.weight,
          confidence: classification.confidence,
          justification: classification.justification,
          source: classification.source,
          stage,
          stageMultiplier,
          points: weight,
          methodologyVersion: classification.methodologyVersion,
          roleWeight: ROLE_WEIGHTS[role],
          natureWeight: NATURE_WEIGHTS[nature],
          progressBonus:
            stage === "converted"
              ? PROGRESS_BONUS.BECAME_NORM
              : stage === "advanced"
                ? PROGRESS_BONUS.ADVANCED
                : 0,
          scoreExplanation: `Papel: ${proposal.participationLabel || role} × ${proposal.proposalNatureLabel || nature}`,
        };
      }

      if (deputy.publicVotes) {
        for (const vote of deputy.publicVotes) {
          const analysis = classifyPublicVote(vote.voteId, vote.description || "", vote.summary || "");
          if (!analysis) continue;
          votesReclassified++;
          const candidateVote = normalizePublicVote(vote.candidateVote as CandidateVote || "absent");
          const record = buildPublicVoteRecord(analysis, 0, candidateVote);
          vote.classification = analysis.classification;
          vote.severity = analysis.severity;
          vote.scoreDelta = record.scoreDelta;
          vote.confidence = record.confidence;
          vote.reason = analysis.reason;
          vote.source = analysis.source;
          vote.reviewedManually = analysis.reviewedManually;
        }
      }
    }
  }

  type ProfileProposal = ProfilePeriodDetails["proposals"][number];
type ProfileVote = NonNullable<ProfilePeriodDetails["publicVotes"]>[number];

for (const period of ranking.periods) {
    for (const deputy of period.deputies) {
      let proposals: ProfileProposal[];
      let votes: ProfileVote[];

      if (period.id === "legislature") {
        const proposalMap = new Map<string, ProfileProposal>();
        const voteMap = new Map<string, ProfileVote>();
        for (const yearlyPeriod of profiles.periods) {
          const yearlyDeputy = yearlyPeriod.deputies.find((d) => d.id === deputy.id);
          if (!yearlyDeputy) continue;
          for (const proposal of yearlyDeputy.proposals || []) {
            if (!proposalMap.has(proposal.id)) {
              proposalMap.set(proposal.id, proposal);
            }
          }
          for (const vote of yearlyDeputy.publicVotes || []) {
            const key = `${vote.voteId}-${vote.candidateVote}`;
            if (!voteMap.has(key)) {
              voteMap.set(key, vote);
            }
          }
        }
        proposals = Array.from(proposalMap.values());
        votes = Array.from(voteMap.values());
      } else {
        const profilePeriod = profiles.periods.find((p) => p.id === period.id);
        const profileDeputy = profilePeriod?.deputies.find((d) => d.id === deputy.id);
        proposals = profileDeputy?.proposals || [];
        votes = profileDeputy?.publicVotes || [];
      }

      const classified = proposals.filter((p) => p.publicValue !== null);
      const total = proposals.length;
      const publicContributionPoints = classified.reduce(
        (sum, p) => sum + (p.publicValue?.points || 0),
        0,
      );

      let positive = 0;
      let votePenalties = 0;
      let absencePenalties = 0;
      let confidence = 0;
      const analyzed = votes.length;

      for (const vote of votes) {
        if (vote.scoreDelta > 0) {
          positive += vote.scoreDelta;
        } else if (vote.scoreDelta < 0 && vote.candidateVote === "absent") {
          absencePenalties += Math.abs(vote.scoreDelta);
        } else if (vote.scoreDelta < 0) {
          votePenalties += Math.abs(vote.scoreDelta);
        }
        confidence += vote.confidence;
      }

      const voteScore = positive - votePenalties - absencePenalties;
      deputy.metrics.publicContributionPoints = classified.length > 0 ? Number(publicContributionPoints.toFixed(2)) : null;
      deputy.metrics.publicClassifiedProposals = classified.length;
      deputy.metrics.publicTotalProposals = total;

      deputy.metrics.publicVotePositivePoints = Number(positive.toFixed(2)) || undefined;
      deputy.metrics.publicVoteNegativePenalties = Number(votePenalties.toFixed(2)) || undefined;
      deputy.metrics.publicVoteAbsencePenalties = Number(absencePenalties.toFixed(2)) || undefined;
      deputy.metrics.publicVotesAnalyzed = analyzed;
      deputy.metrics.publicVoteAverageConfidence = analyzed > 0 ? Number((confidence / analyzed).toFixed(3)) : null;
      deputy.metrics.publicVoteScore = analyzed > 0 ? Number(voteScore.toFixed(2)) : null;
    }
  }

  const proposalsMap = new Map<string, { id: string; type: string; number: string; year: string; summary: string; url: string }>();
  for (const period of profiles.periods) {
    for (const deputy of period.deputies) {
      for (const proposal of deputy.proposals) {
        if (!classifyProposal(proposal.id, proposal.summary)) {
          proposalsMap.set(proposal.id, {
            id: proposal.id,
            type: proposal.type,
            number: proposal.number,
            year: proposal.year,
            summary: proposal.summary,
            url: proposal.url,
          });
        }
      }
    }
  }

  const metadata = publicValueClassificationMetadata();
  const pending = {
    generatedAt: new Date().toISOString(),
    methodologyVersion: metadata.methodologyVersion,
    total: proposalsMap.size,
    proposals: [...proposalsMap.values()].sort(
      (a, b) => Number(b.year) - Number(a.year) || a.id.localeCompare(b.id),
    ),
  };

  const classificationFile: { classifications: Record<string, unknown> } = JSON.parse(
    readFileSync(new URL("../.data/public-value-classifications.json", import.meta.url), "utf-8"),
  );
  const classified = Object.keys(classificationFile.classifications).length;
  const pendingCount = pending.total;
  const totalClassifiable = classified + pendingCount;
  const aiProgress = totalClassifiable > 0 ? Math.round((classified / totalClassifiable) * 100 * 10) / 10 : 0;

  const defaultPeriod = ranking.periods.find((p) => p.id === ranking.defaultPeriod);
  const totalDeputies = defaultPeriod?.deputies.length || 0;
  const categories = [
    (d: PeriodDeputyRecord) => d.metrics.plenaryAttendances !== null,
    (d: PeriodDeputyRecord) => d.metrics.nominalVotes !== null,
    (d: PeriodDeputyRecord) => d.metrics.substantiveProposals !== null,
    (d: PeriodDeputyRecord) => d.metrics.expensesTotal !== null,
    (d: PeriodDeputyRecord) => d.metrics.campaignCandidacyAvailable === true,
    (d: PeriodDeputyRecord) => d.metrics.assetsAvailable === true,
    (d: PeriodDeputyRecord) => (d.metrics.publicVotesAnalyzed ?? 0) > 0,
  ];
  const filled = defaultPeriod
    ? categories.reduce((sum, fn) => sum + defaultPeriod.deputies.filter(fn).length, 0)
    : 0;
  const dataCoveragePercent = defaultPeriod
    ? Math.round((filled / (totalDeputies * categories.length)) * 100)
    : 0;

  const bannerMetadata = {
    dataCoveragePercent,
    aiClassificationsClassified: classified,
    aiClassificationsTotal: totalClassifiable,
    aiProgressPercent: aiProgress,
    lastUpdatedAt: ranking.generatedAt.split("T")[0],
  };

  await mkdir(new URL("../.data", import.meta.url), { recursive: true });
  await writeFile(RANKING_PATH, `${JSON.stringify(ranking, null, 2)}\n`);
  await writeFile(PROFILE_PATH, `${JSON.stringify(profiles)}\n`);
  await writeFile(PENDING_PATH, `${JSON.stringify(pending, null, 2)}\n`);
  await writeFile(BANNER_PATH, `${JSON.stringify(bannerMetadata, null, 2)}\n`);

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(`\n════════════════════════════════════`);
  console.log(`✅ Classificações aplicadas em ${elapsed}s`);
  console.log(`📊 ${proposalsReclassified} proposições e ${votesReclassified} votações reclassificadas`);
  console.log(`⏳ ${pendingCount} proposições ainda pendentes de classificação`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});