"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  DimensionCardInfo,
  DimensionExplanation,
} from "@/lib/dimension-explanations";
import { publicValueScoreLabel } from "@/lib/ranking";
import { scoreStyle } from "@/lib/score-style";
import { cn } from "@/lib/utils";

export function DimensionCard({
  label,
  value,
  explanation,
  cardInfo,
}: {
  label: string;
  value: number | null;
  explanation: DimensionExplanation;
  cardInfo: DimensionCardInfo;
}) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const style = scoreStyle(value, "public-value");
  const labelText = value !== null ? publicValueScoreLabel(value) : null;
  const pct = value !== null ? value : null;

  return (
    <div className="rounded-lg border p-5">
      {/* Top row: title + score */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{label}</h3>
            <Tooltip>
              <TooltipTrigger className="inline-flex items-center justify-center rounded-full hover:bg-muted transition-colors size-5">
                <Info className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-80 text-xs leading-relaxed">
                <p className="font-semibold mb-1">{explanation.title}</p>
                <p className="text-muted-foreground">{explanation.description}</p>
                {explanation.details.map((detail) => (
                  <p key={detail} className="mt-1 text-muted-foreground before:content-['•_'] before:opacity-50">
                    {detail}
                  </p>
                ))}
              </TooltipContent>
            </Tooltip>
          </div>
          {cardInfo.subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {cardInfo.subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-3xl font-bold tabular-nums leading-none", style.text)}>
              {value ?? "N/D"}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          {labelText && (
            <span className={cn("text-xs font-medium", style.text)}>
              {labelText}
            </span>
          )}
        </div>
      </div>

      {/* Percentile context */}
      {pct !== null && (
        <div className="mt-4 space-y-1.5">
          <p className="text-sm font-medium">
            Supera <span className={cn("tabular-nums", style.text)}>{pct}%</span> dos deputados
          </p>
          {/* Bar */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-500", style.indicator)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span className={cn("font-medium tabular-nums", style.text)}>{pct}%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {pct === null && (
        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-muted" />
        </div>
      )}

      {/* Formula line */}
      {cardInfo.formulaLine && (
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          {cardInfo.formulaLine}
        </p>
      )}

      {/* Chips */}
      {cardInfo.chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {cardInfo.chips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-xs tabular-nums text-muted-foreground"
            >
              <span className="font-medium text-foreground">{chip.value}</span>
              {chip.label}
            </span>
          ))}
        </div>
      )}

      {/* Steps accordion */}
      {cardInfo.steps.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStepsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Como calculamos
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                stepsOpen && "rotate-180",
              )}
            />
          </Button>
          {stepsOpen && (
            <div className="mt-3 space-y-3">
              {cardInfo.steps.map((step, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-xs font-medium text-foreground">
                    {i + 1}. {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.result}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
