"use client";

import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DimensionExplanation } from "@/lib/dimension-explanations";
import {
  publicValueScoreLabel,
  scoreLabel,
  type RankingIndex,
} from "@/lib/ranking";
import { scoreStyle } from "@/lib/score-style";
import { cn } from "@/lib/utils";

export function DimensionScore({
  label,
  value,
  compact = false,
  explanation,
  index = "current",
}: {
  label: string;
  value: number | null;
  compact?: boolean;
  explanation?: DimensionExplanation;
  index?: RankingIndex;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const style = scoreStyle(value, index);

  const content = (
    <div className={cn("space-y-1.5", compact && "min-w-20")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("flex items-center gap-1.5 text-xs font-semibold tabular-nums", style.text)}>
          <span className={cn("size-2 rounded-full", style.dot)} aria-hidden="true" />
          {value === null ? "N/D" : value}
          {!compact && value !== null && (
            <span className="font-medium">
              ·{" "}
              {index === "public-value"
                ? publicValueScoreLabel(value)
                : scoreLabel(value)}
            </span>
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

  if (!explanation) return content;

  return (
    <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
      <TooltipTrigger
        closeOnClick={false}
        render={
          <button
            type="button"
            onClick={() => setTooltipOpen((current) => !current)}
            className="block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Entenda ${explanation.title}`}
          >
            {content}
          </button>
        }
      />
      <TooltipContent
        className="block max-w-80 space-y-2 px-3 py-2 text-left leading-5"
        side="top"
      >
        <p className="font-semibold">{explanation.title}</p>
        <p>{explanation.description}</p>
        {explanation.details.map((detail) => (
          <p key={detail} className="opacity-80">
            {detail}
          </p>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
