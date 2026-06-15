"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Minus,
  SearchX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  type PublicValueRankedDeputy,
  type RankChange,
  type RankedDeputy,
  type RankingIndex,
} from "@/lib/ranking";
import { dimensionExplanation } from "@/lib/dimension-explanations";
import { labelTone } from "@/lib/label-tone";
import { cn } from "@/lib/utils";
import { DimensionScore } from "./dimension-score";
import { SemanticScore } from "./semantic-score";
import type {
  RankingDirection,
} from "./ranking-browser";
import type { RankingOrder } from "./ranking-filters";

export function RankingTable({
  deputies,
  index,
  order,
  direction,
  onOrderChange,
  contextQuery,
  rankChanges,
}: {
  deputies: Array<RankedDeputy | PublicValueRankedDeputy>;
  index: RankingIndex;
  order: RankingOrder;
  direction: RankingDirection;
  onOrderChange: (value: RankingOrder) => void;
  contextQuery: string;
  rankChanges: Map<number, RankChange>;
}) {
  if (deputies.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center text-center">
        <SearchX className="mb-3 size-8 text-muted-foreground" />
        <p className="font-medium">Nenhum deputado encontrado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Revise a busca ou os filtros selecionados.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                className="w-16"
                label="#"
                value="score"
                order={order}
                direction={direction}
                onOrderChange={onOrderChange}
                centered
              />
              <SortableHead
                label="Deputado"
                value="name"
                order={order}
                direction={direction}
                onOrderChange={onOrderChange}
              />
              <SortableHead
                className="min-w-28"
                label="Participação"
                value="participation"
                order={order}
                direction={direction}
                onOrderChange={onOrderChange}
              />
              <SortableHead
                className="min-w-28"
                label={index === "public-value" ? "Contribuição" : "Produção"}
                value={index === "public-value" ? "contribution" : "production"}
                order={order}
                direction={direction}
                onOrderChange={onOrderChange}
              />
              <SortableHead
                className="min-w-28"
                label={index === "public-value" ? "Eficiência" : "Recursos"}
                value={index === "public-value" ? "efficiency" : "resources"}
                order={order}
                direction={direction}
                onOrderChange={onOrderChange}
              />
              {index === "public-value" && (
                <SortableHead
                  className="min-w-28"
                  label="Votos públicos"
                  value="publicVotes"
                  order={order}
                  direction={direction}
                  onOrderChange={onOrderChange}
                />
              )}
              <SortableHead
                className="min-w-28"
                label="Transparência"
                value="transparency"
                order={order}
                direction={direction}
                onOrderChange={onOrderChange}
              />
              <SortableHead
                className="w-28"
                label="Score"
                value="score"
                order={order}
                direction={direction}
                onOrderChange={onOrderChange}
                centered
              />
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deputies.map((deputy) => (
              <TableRow key={deputy.id}>
                <TableCell className="text-center">
                  <p className="text-xl font-semibold tabular-nums">
                    {deputy.rank ?? "—"}
                  </p>
                  <RankTrend change={rankChanges.get(deputy.id)} compact />
                </TableCell>
                <TableCell>
                  <DeputyIdentity deputy={deputy} />
                </TableCell>
                <TableCell>
                  <DimensionScore
                    label={`${deputy.metrics.plenaryAttendances ?? "N/D"} sessões`}
                    value={deputy.dimensions.participation}
                    explanation={dimensionExplanation(
                      deputy,
                      index,
                      "participation",
                    )}
                    index={index}
                    compact
                  />
                </TableCell>
                <TableCell>
                  {index === "public-value" ? (
                    <DimensionScore
                      label={`${deputy.metrics.publicClassifiedProposals ?? 0}/${
                        deputy.metrics.publicTotalProposals ?? 0
                      } classificadas`}
                      value={publicDimension(deputy, "contribution")}
                      explanation={dimensionExplanation(
                        deputy,
                        index,
                        "contribution",
                      )}
                      index={index}
                      compact
                    />
                  ) : (
                    <DimensionScore
                      label={`${deputy.metrics.substantiveProposals ?? "N/D"} propostas`}
                      value={currentDimension(deputy, "production")}
                      explanation={dimensionExplanation(
                        deputy,
                        index,
                        "production",
                      )}
                      index={index}
                      compact
                    />
                  )}
                </TableCell>
                <TableCell>
                  <DimensionScore
                    label={formatCurrency(deputy.metrics.expensesTotal)}
                    value={
                      index === "public-value"
                        ? publicDimension(deputy, "efficiency")
                        : currentDimension(deputy, "resources")
                    }
                    explanation={dimensionExplanation(
                      deputy,
                      index,
                      index === "public-value" ? "efficiency" : "resources",
                    )}
                    index={index}
                    compact
                  />
                </TableCell>
                {index === "public-value" && (
                  <TableCell>
                    <DimensionScore
                      label={`${deputy.metrics.publicVotesAnalyzed ?? 0} analisados`}
                      value={publicDimension(deputy, "publicVotes")}
                      explanation={dimensionExplanation(
                        deputy,
                        index,
                        "publicVotes",
                      )}
                      index={index}
                      compact
                    />
                  </TableCell>
                )}
                <TableCell>
                  <DimensionScore
                    label="dados oficiais"
                    value={deputy.dimensions.transparency}
                    explanation={dimensionExplanation(
                      deputy,
                      index,
                      "transparency",
                    )}
                    index={index}
                    compact
                  />
                </TableCell>
                <TableCell className="text-center">
                  <SemanticScore value={deputy.score} index={index} compact />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/candidatos/${deputy.slug}${contextQuery}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Perfil <ArrowRight className="size-3.5" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid min-w-0 gap-4 lg:hidden">
        {deputies.map((deputy) => (
          <article
            key={deputy.id}
            className="min-w-0 overflow-hidden rounded-lg border bg-card p-4 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <p className="w-8 shrink-0 pt-1 text-center text-xl font-semibold tabular-nums">
                {deputy.rank ?? "—"}
              </p>
              <div className="min-w-0 flex-1">
                <DeputyIdentity deputy={deputy} />
              </div>
              <SemanticScore value={deputy.score} index={index} compact />
            </div>
            <div className="mt-3 pl-11">
              <RankTrend change={rankChanges.get(deputy.id)} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <DimensionScore
                label="Participação"
                value={deputy.dimensions.participation}
                explanation={dimensionExplanation(
                  deputy,
                  index,
                  "participation",
                )}
                index={index}
              />
              <DimensionScore
                label={index === "public-value" ? "Contribuição" : "Produção"}
                value={
                  index === "public-value"
                    ? publicDimension(deputy, "contribution")
                    : currentDimension(deputy, "production")
                }
                explanation={dimensionExplanation(
                  deputy,
                  index,
                  index === "public-value" ? "contribution" : "production",
                )}
                index={index}
              />
              <DimensionScore
                label={index === "public-value" ? "Eficiência" : "Recursos"}
                value={
                  index === "public-value"
                    ? publicDimension(deputy, "efficiency")
                    : currentDimension(deputy, "resources")
                }
                explanation={dimensionExplanation(
                  deputy,
                  index,
                  index === "public-value" ? "efficiency" : "resources",
                )}
                index={index}
              />
              {index === "public-value" && (
                <DimensionScore
                  label="Votos públicos"
                  value={publicDimension(deputy, "publicVotes")}
                  explanation={dimensionExplanation(
                    deputy,
                    index,
                    "publicVotes",
                  )}
                  index={index}
                />
              )}
              <DimensionScore
                label="Transparência"
                value={deputy.dimensions.transparency}
                explanation={dimensionExplanation(
                  deputy,
                  index,
                  "transparency",
                )}
                index={index}
              />
            </div>
            <Link
              href={`/candidatos/${deputy.slug}${contextQuery}`}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-5 w-full active:scale-[0.96] transition-transform",
              )}
            >
              Ver perfil completo <ArrowRight className="size-4" />
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}

function SortableHead({
  label,
  value,
  order,
  direction,
  onOrderChange,
  className,
  centered = false,
}: {
  label: string;
  value: RankingOrder;
  order: RankingOrder;
  direction: RankingDirection;
  onOrderChange: (value: RankingOrder) => void;
  className?: string;
  centered?: boolean;
}) {
  const active = order === value;
  const Icon = active
    ? direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  return (
    <TableHead
      className={className}
      aria-sort={
        active
          ? direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        onClick={() => onOrderChange(value)}
        className={cn(
          "-mx-2 inline-flex min-h-10 w-[calc(100%+1rem)] items-center gap-1.5 px-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          centered && "justify-center text-center",
          active && "font-semibold",
        )}
      >
        {label}
        <Icon
          className={cn(
            "size-3.5",
            active ? "text-foreground" : "text-muted-foreground/60",
          )}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  );
}

function RankTrend({
  change,
  compact = false,
}: {
  change?: RankChange;
  compact?: boolean;
}) {
  if (!change?.previousPeriod || change.delta === null) {
    return (
      <span className="mt-1 inline-flex text-[10px] text-muted-foreground">
        Sem comparação
      </span>
    );
  }
  if (change.delta === 0) {
    return (
      <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Minus className="size-3" /> Manteve desde {change.previousPeriod}
      </span>
    );
  }
  const improved = change.delta > 0;
  const Icon = improved ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center gap-1 text-[10px] font-medium",
        improved ? "text-emerald-600" : "text-red-600",
        compact && "justify-center",
      )}
    >
      <Icon className="size-3" />
      {Math.abs(change.delta)} desde {change.previousPeriod}
    </span>
  );
}

function DeputyIdentity({
  deputy,
}: {
  deputy: RankedDeputy | PublicValueRankedDeputy;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-muted outline outline-1 -outline-offset-1 outline-black/10">
        <Image
          src={deputy.photoUrl}
          alt={`Foto oficial de ${deputy.name}`}
          fill
          sizes="48px"
          className="object-cover object-top"
        />
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold">{deputy.name}</p>
        <p className="text-sm text-muted-foreground">
          {deputy.party} · {deputy.state}
          {deputy.electionNumber ? ` · ${deputy.electionNumber}` : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {deputy.labels.slice(0, 2).map((label) => (
            <Badge
              key={label}
              variant="outline"
              className={cn("text-[10px]", labelStyle(label))}
            >
              {label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function currentDimension(
  deputy: RankedDeputy | PublicValueRankedDeputy,
  key: "production" | "resources",
) {
  if (!("production" in deputy.dimensions)) return null;
  return key === "production"
    ? deputy.dimensions.production
    : deputy.dimensions.resources;
}

function publicDimension(
  deputy: RankedDeputy | PublicValueRankedDeputy,
  key: "contribution" | "publicVotes" | "efficiency",
) {
  if (!("contribution" in deputy.dimensions)) return null;
  if (key === "contribution") return deputy.dimensions.contribution;
  if (key === "publicVotes") return deputy.dimensions.publicVotes;
  return deputy.dimensions.efficiency;
}

function labelStyle(label: string) {
  const tone = labelTone(label);

  if (tone === "positive") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400";
  }

  if (tone === "negative") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400";
  }

  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400";
}
