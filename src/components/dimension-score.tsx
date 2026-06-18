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
  compactBar = false,
  dense = false,
  explanation,
  index = "current",
}: {
  label: string;
  value: number | null;
  compact?: boolean;
  compactBar?: boolean;
  dense?: boolean;
  explanation?: DimensionExplanation;
  index?: RankingIndex;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const style = scoreStyle(value, index);
  const semanticLabel =
    value === null
      ? null
      : index === "public-value"
        ? publicValueScoreLabel(value)
        : scoreLabel(value);

  const content = compact ? (
    compactBar ? (
      <div className="min-w-0 space-y-1.5">
        <span
          className={cn(
            "block text-center text-sm font-semibold tabular-nums",
            style.text,
          )}
        >
          {value === null ? "N/D" : value}
        </span>
        <Progress
          value={value ?? 0}
          className="h-1.5 w-full"
          indicatorClassName={style.indicator}
        />
      </div>
    ) : (
      <span
        className={cn(
          "block text-center text-sm font-semibold tabular-nums",
          style.text,
        )}
      >
        {value === null ? "N/D" : value}
      </span>
    )
  ) : (
    <div className={cn("min-w-0 space-y-1.5", dense && "space-y-1")}>
      <div
        className={cn(
          "flex min-w-0 items-center justify-between gap-2",
          dense && "flex-col items-start justify-start gap-0.5",
        )}
      >
        <span
          className={cn(
            "min-w-0 text-xs text-muted-foreground",
            dense && "w-full truncate text-[11px] leading-4",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 text-xs font-semibold tabular-nums",
            dense && "w-full gap-1 overflow-hidden whitespace-nowrap text-[11px] leading-4",
            style.text,
          )}
        >
          {dense ? (
            value === null ? (
              "N/D"
            ) : (
              <>
                <span className="shrink-0">{value}</span>
                <span className="min-w-0 truncate font-medium">
                  · {semanticLabel}
                </span>
              </>
            )
          ) : (
            <>
              {value === null ? "N/D" : value}
              {semanticLabel && (
                <span className="truncate font-medium">· {semanticLabel}</span>
              )}
            </>
          )}
        </span>
      </div>
      <Progress value={value ?? 0} indicatorClassName={style.indicator} />
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
