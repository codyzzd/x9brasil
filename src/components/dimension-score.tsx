import { Progress } from "@/components/ui/progress";
import { scoreLabel } from "@/lib/ranking";
import { scoreStyle } from "@/lib/score-style";
import { cn } from "@/lib/utils";

export function DimensionScore({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | null;
  compact?: boolean;
}) {
  const style = scoreStyle(value);

  return (
    <div className={cn("space-y-1.5", compact && "min-w-20")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("flex items-center gap-1.5 text-xs font-semibold tabular-nums", style.text)}>
          <span className={cn("size-2 rounded-full", style.dot)} aria-hidden="true" />
          {value === null ? "N/D" : value}
          {!compact && value !== null && (
            <span className="font-medium">· {scoreLabel(value)}</span>
          )}
        </span>
      </div>
      <Progress
        value={value ?? 0}
        className={cn(compact && "h-1.5")}
        indicatorClassName={style.indicator}
      />
    </div>
  );
}
