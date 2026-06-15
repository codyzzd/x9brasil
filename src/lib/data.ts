import snapshotJson from "@/data/ranking-snapshot.json";
import {
  getRankingPeriod,
  materializePeriod,
  type RankingSnapshot,
} from "@/lib/ranking";

export const rankingSnapshot = snapshotJson as unknown as RankingSnapshot;

export function getDeputy(slug: string) {
  return rankingSnapshot.deputies.find((deputy) => deputy.slug === slug);
}

export function getPeriodDeputies(periodId: string) {
  return materializePeriod(rankingSnapshot, periodId);
}

export function getPeriodOptions() {
  return rankingSnapshot.periods.map(({ id, label, partial, end }) => ({
    id,
    label,
    partial,
    end,
  }));
}

export function getPeriodFacets(periodId: string) {
  const deputies = getPeriodDeputies(periodId);
  return {
    states: Array.from(new Set(deputies.map((deputy) => deputy.state))).sort(
      (a, b) => a.localeCompare(b, "pt-BR"),
    ),
    parties: Array.from(new Set(deputies.map((deputy) => deputy.party))).sort(
      (a, b) => a.localeCompare(b, "pt-BR"),
    ),
  };
}

export function resolvePeriod(periodId?: string) {
  return getRankingPeriod(
    rankingSnapshot,
    periodId || rankingSnapshot.defaultPeriod,
  );
}
