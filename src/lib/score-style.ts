import {
  publicValueScoreBand,
  scoreBand,
  type PublicValueScoreBand,
  type RankingIndex,
  type ScoreBand,
} from "@/lib/ranking";

const styles: Record<
  ScoreBand,
  {
    dot: string;
    text: string;
    soft: string;
    border: string;
    indicator: string;
  }
> = {
  good: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    soft: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-900",
    indicator: "bg-emerald-500",
  },
  medium: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    soft: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-900",
    indicator: "bg-amber-500",
  },
  low: {
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
    soft: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-900",
    indicator: "bg-red-500",
  },
  unavailable: {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    soft: "bg-muted",
    border: "border-border",
    indicator: "bg-muted-foreground",
  },
};

const publicValueStyles: Record<
  PublicValueScoreBand,
  (typeof styles)[ScoreBand]
> = {
  excellent: styles.good,
  high: {
    ...styles.good,
    dot: "bg-emerald-400",
    indicator: "bg-emerald-400",
  },
  medium: styles.medium,
  low: {
    dot: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-400",
    soft: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-900",
    indicator: "bg-orange-500",
  },
  "very-low": styles.low,
  unavailable: styles.unavailable,
};

export function scoreStyle(
  value: number | null,
  index: RankingIndex = "current",
) {
  return index === "public-value"
    ? publicValueStyles[publicValueScoreBand(value)]
    : styles[scoreBand(value)];
}
