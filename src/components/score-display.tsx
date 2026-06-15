import { Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ScoreDisplayProps = {
  label: string;
  value: number;
  description: string;
  compact?: boolean;
};

export function ScoreDisplay({
  label,
  value,
  description,
  compact = false,
}: ScoreDisplayProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {label}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className="flex size-10 -m-3 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={`Entenda ${label}`}
                >
                  <Info className="size-3.5" />
                </button>
              }
            />
            <TooltipContent className="max-w-64">{description}</TooltipContent>
          </Tooltip>
        </div>
        <span
          className={
            compact
              ? "text-sm font-semibold tabular-nums"
              : "text-2xl font-semibold tabular-nums"
          }
        >
          {value}
          <span className="text-xs font-normal text-muted-foreground">/100</span>
        </span>
      </div>
      <Progress value={value} />
    </div>
  );
}
