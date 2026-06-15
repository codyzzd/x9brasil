import {
  publicValueScoreLabel,
  scoreLabel,
  type RankingIndex,
} from "@/lib/ranking";
import { scoreStyle } from "@/lib/score-style";
import { cn } from "@/lib/utils";

export function SemanticScore({
  value,
  compact = false,
  className,
  index = "current",
}: {
  value: number | null;
  compact?: boolean;
  className?: string;
  index?: RankingIndex;
}) {
  const style = scoreStyle(value, index);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2",
        style.soft,
        style.border,
        className,
      )}
    >
      <span
        className={cn(compact ? "size-2" : "size-2.5", "rounded-full", style.dot)}
        aria-hidden="true"
      />
      <div className={cn("leading-none", compact ? "text-left" : "text-center")}>
        <p
          className={cn(
            "font-semibold tabular-nums",
            compact ? "text-xl" : "text-3xl",
            style.text,
          )}
        >
          {value ?? "—"}
        </p>
        <p className={cn("mt-1 text-xs font-medium", style.text)}>
          {index === "public-value"
            ? publicValueScoreLabel(value)
            : scoreLabel(value)}
        </p>
      </div>
    </div>
  );
}
