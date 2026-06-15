import snapshotJson from "@/data/ranking-snapshot.json";
import type { RankingSnapshot } from "@/lib/ranking";

export const rankingSnapshot = snapshotJson as RankingSnapshot;

export function getDeputy(slug: string) {
  return rankingSnapshot.deputies.find((deputy) => deputy.slug === slug);
}

export const states = Array.from(
  new Set(rankingSnapshot.deputies.map((deputy) => deputy.state)),
).sort((a, b) => a.localeCompare(b, "pt-BR"));

export const parties = Array.from(
  new Set(rankingSnapshot.deputies.map((deputy) => deputy.party)),
).sort((a, b) => a.localeCompare(b, "pt-BR"));
