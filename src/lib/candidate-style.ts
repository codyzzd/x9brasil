import type { RawMetrics } from "@/lib/ranking";

export type CandidateStyle = {
  id: string;
  label: string;
};

const ROLE_STYLES = [
  { key: "authorProposals" as const, id: "propositor", label: "Propositor" },
  { key: "fiscalizationProposals" as const, id: "fiscalizador", label: "Fiscalizador" },
  { key: "coauthorProposals" as const, id: "coautor", label: "Coautor" },
  { key: "requesterProposals" as const, id: "requerente", label: "Requerente" },
];

export function getCandidateStyle(metrics: RawMetrics): CandidateStyle | null {
  const total =
    (metrics.authorProposals ?? 0) +
    (metrics.coauthorProposals ?? 0) +
    (metrics.requesterProposals ?? 0) +
    (metrics.fiscalizationProposals ?? 0);

  // Try role dominance first
  if (total > 0) {
    const withPct = ROLE_STYLES.map((s) => ({
      ...s,
      pct: (metrics[s.key] ?? 0) / total,
    })).sort((a, b) => b.pct - a.pct);

    const top = withPct[0];
    const second = withPct[1];

    if (top.pct >= 0.35 && top.pct > second.pct + 0.1) {
      return { id: top.id, label: top.label };
    }
  }

  // Check if voting dominates over proposing
  const votes = metrics.nominalVotes ?? 0;
  if (total > 0 && votes > total * 10) {
    return { id: "votador", label: "Votador" };
  }

  if (votes > 0 && total === 0) {
    return { id: "votador", label: "Votador" };
  }

  // Fallback: nothing distinctive
  return null;
}
