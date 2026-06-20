"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Minus,
  SearchX,
  Zap,
  Flame,
  UserCheck,
  FileText,
  Scale,
  UserX,
  TrendingDown,
  FileMinus,
  AlertTriangle,
  FileQuestion,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type PublicValueRankedDeputy,
  type RankChange,
  type RankedDeputy,
  type RankingIndex,
} from "@/lib/ranking";
import { PUBLIC_VALUE_DIMENSION_LABELS } from "@/lib/public-value";
import { dimensionExplanation } from "@/lib/dimension-explanations";
import { labelTone } from "@/lib/label-tone";
import { cn } from "@/lib/utils";
import { DimensionScore } from "./dimension-score";
import { SemanticScore } from "./semantic-score";
import type { RankingOrder } from "./ranking-filters";

type RankingDirection = "asc" | "desc";

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
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <SortableHead
                className="w-20"
                label="#"
                value="score"
                order={order}
                direction={direction}
                onOrderChange={onOrderChange}
                centered
              />
              <SortableHead
                className="w-[26%]"
                label="Deputado"
                value="name"
                order={order}
                direction={direction}
                onOrderChange={onOrderChange}
              />
              <TableHead className="w-28 text-center">Mandato</TableHead>
              <SortableHead
                className="w-28"
                label="Score"
                value="score"
                order={order}
                direction={direction}
                onOrderChange={onOrderChange}
                centered
              />
              <TableHead>Dimensões</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deputies.map((deputy) => (
              <TableRow key={deputy.id} className="group">
                <TableCell className="text-center">
                  <p className="text-xl font-semibold tabular-nums">
                    {deputy.rank ?? "—"}
                  </p>
                  <RankTrend change={rankChanges.get(deputy.id)} compact />
                </TableCell>
                <TableCell>
                  <DeputyIdentity
                    deputy={deputy}
                    href={`/candidatos/${deputy.slug}${contextQuery}`}
                    compact
                  />
                </TableCell>
                <TableCell className="text-center">
                  <MandateTime months={deputy.metrics.monthsInOffice} />
                </TableCell>
                <TableCell className="text-center">
                  <SemanticScore value={deputy.score} index={index} compact />
                </TableCell>
                <TableCell>
                  <DimensionSummary deputy={deputy} index={index} />
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
                <DeputyIdentity
                  deputy={deputy}
                  href={`/candidatos/${deputy.slug}${contextQuery}`}
                />
              </div>
              <SemanticScore value={deputy.score} index={index} compact />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 pl-11">
              <RankTrend change={rankChanges.get(deputy.id)} />
              <MandateTime months={deputy.metrics.monthsInOffice} inline />
            </div>
            <DimensionSummary deputy={deputy} index={index} className="mt-5" />
          </article>
        ))}
      </div>
    </>
  );
}

function DimensionSummary({
  deputy,
  index,
  className,
}: {
  deputy: RankedDeputy | PublicValueRankedDeputy;
  index: RankingIndex;
  className?: string;
}) {
  const items = dimensionItems(deputy, index);
  const weakest = Math.min(
    ...items
      .map((item) => item.value)
      .filter((value): value is number => value !== null),
  );
  const hasWeakest = Number.isFinite(weakest);

  return (
    <div
      className={cn(
        "grid min-w-0 gap-2",
        items.length === 5
          ? "min-[560px]:grid-cols-5"
          : "min-[560px]:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => {
        const weak = hasWeakest && item.value === weakest;

        return (
          <div
            key={item.key}
            className={cn(
              "min-w-0 rounded-md px-2 py-1.5",
              weak &&
                "bg-amber-50 ring-1 ring-amber-200/70 dark:bg-amber-950/20 dark:ring-amber-900/40",
            )}
          >
            <DimensionScore
              label={item.label}
              value={item.value}
              explanation={item.explanation}
              index={index}
              compact
              compactBar
              showCompactLabel
              compactValueAlign="right"
            />
          </div>
        );
      })}
    </div>
  );
}

function dimensionItems(
  deputy: RankedDeputy | PublicValueRankedDeputy,
  index: RankingIndex,
) {
  const productionKey =
    index === "public-value" ? "contribution" : "production";
  const resourcesKey = index === "public-value" ? "efficiency" : "resources";

  return [
    {
      key: "participation",
      label: "Part.",
      value: deputy.dimensions.participation,
      explanation: dimensionExplanation(deputy, index, "participation"),
    },
    {
      key: productionKey,
      label: "Prod.",
      value:
        index === "public-value"
          ? publicDimension(deputy, "contribution")
          : currentDimension(deputy, "production"),
      explanation: dimensionExplanation(deputy, index, productionKey),
    },
    ...(index === "public-value"
      ? [
          {
            key: "publicVotes" as const,
            label: PUBLIC_VALUE_DIMENSION_LABELS.publicVotes,
            value: publicDimension(deputy, "publicVotes"),
            explanation: dimensionExplanation(deputy, index, "publicVotes"),
          },
        ]
      : []),
    {
      key: resourcesKey,
      label: index === "public-value" ? "Efic." : "Rec.",
      value:
        index === "public-value"
          ? publicDimension(deputy, "efficiency")
          : currentDimension(deputy, "resources"),
      explanation: dimensionExplanation(deputy, index, resourcesKey),
    },
    {
      key: "campaignFinance",
      label: "Camp.",
      value: deputy.dimensions.campaignFinance,
      explanation: dimensionExplanation(deputy, index, "campaignFinance"),
    },
  ];
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

function MandateTime({
  months,
  inline = false,
}: {
  months: number;
  inline?: boolean;
}) {
  const roundedMonths = Math.max(0, Math.round(months));
  const label = roundedMonths === 1 ? "mês" : "meses";
  const accessibleLabel = `${roundedMonths} ${label} no período`;

  if (inline) {
    return (
      <span
        className="inline-flex items-baseline gap-1 text-[10px] text-muted-foreground"
        aria-label={accessibleLabel}
      >
        <span className="font-medium tabular-nums text-foreground">
          {roundedMonths}
        </span>
        {" "}
        <span>{label} no período</span>
      </span>
    );
  }

  return (
    <div className="leading-tight" aria-label={accessibleLabel}>
      <p className="text-sm font-semibold tabular-nums">
        {roundedMonths} {label}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">no período</p>
    </div>
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
  href,
  compact = false,
}: {
  deputy: RankedDeputy | PublicValueRankedDeputy;
  href: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
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
        <p className="truncate font-semibold group-hover:underline">
          {deputy.name}
        </p>
        <p className="text-sm text-muted-foreground">
          {deputy.party} · {deputy.state}
          {deputy.electionNumber ? ` · ${deputy.electionNumber}` : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {deputy.labels.slice(0, 2).map((label) => 
            compact ? (
              <CompactLabel key={label} label={label} />
            ) : (
              <Badge
                key={label}
                variant="outline"
                className={cn("text-[10px]", labelStyle(label))}
              >
                {label}
              </Badge>
            )
          )}
        </div>
      </div>
    </Link>
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

function CompactLabel({ label }: { label: string }) {
  const { Icon, className } = getLabelConfig(label);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "flex size-5 items-center justify-center rounded-full border text-[10px] cursor-default transition-colors",
              className
            )}
            aria-label={label}
          >
            <Icon className="size-3" />
          </div>
        }
      />
      <TooltipContent className="px-2 py-1 text-xs font-medium" side="top">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function getLabelConfig(label: string) {
  const tone = labelTone(label);
  
  let colorClass = "";
  if (tone === "positive") {
    colorClass = "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-950/50 dark:bg-emerald-950/20 dark:text-emerald-400";
  } else if (tone === "negative") {
    colorClass = "border-red-200 bg-red-50 text-red-600 dark:border-red-950/50 dark:bg-red-950/20 dark:text-red-400";
  } else {
    colorClass = "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-950/50 dark:bg-amber-950/20 dark:text-amber-400";
  }

  let IconComponent = AlertTriangle;
  
  switch (label) {
    // Positivos
    case "Eficiente":
      IconComponent = Zap;
      break;
    case "Impacto alto":
      IconComponent = Flame;
      break;
    case "Presente":
    case "Participação alta":
      IconComponent = UserCheck;
      break;
    case "Produção alta":
      IconComponent = FileText;
      break;
    case "Uso de recursos equilibrado":
      IconComponent = Scale;
      break;
      
    // Negativos
    case "Muitas ausências":
    case "Participação abaixo da mediana":
      IconComponent = UserX;
      break;
    case "Baixo retorno":
      IconComponent = TrendingDown;
      break;
    case "Produção abaixo da mediana":
      IconComponent = FileMinus;
      break;
    case "Gastos concentrados":
      IconComponent = AlertTriangle;
      break;
    case "Dados incompletos":
      IconComponent = FileQuestion;
      break;
  }

  return { Icon: IconComponent, className: colorClass };
}
