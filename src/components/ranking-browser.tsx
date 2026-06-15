"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  calculatePublicValueRanking,
  calculateRanking,
  calculateRankChanges,
  defaultRankingPeriod,
  filterRankingCohort,
  comparisonPeriod,
  getRankingPeriod,
  materializePeriod,
  searchRankedDeputies,
  type PublicValueRankedDeputy,
  type RankedDeputy,
  type RankingComparison,
  type RankingIndex,
  type RankingSnapshot,
} from "@/lib/ranking";
import { scoreStyle } from "@/lib/score-style";
import { cn } from "@/lib/utils";
import { RankingFilters, type RankingOrder } from "./ranking-filters";
import { RankingTable } from "./ranking-table";

const PAGE_SIZE = 20;
type AnyRankedDeputy = RankedDeputy | PublicValueRankedDeputy;
export type RankingDirection = "asc" | "desc";

export function RankingBrowser({
  snapshot,
  initialIndex = "current",
  initialState = "all",
  initialParty = "all",
  initialPeriod,
  initialComparison = "legislature-start",
}: {
  snapshot: RankingSnapshot;
  initialIndex?: RankingIndex;
  initialState?: string;
  initialParty?: string;
  initialPeriod: string;
  initialComparison?: RankingComparison;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<RankingIndex>(initialIndex);
  const [period, setPeriod] = useState(initialPeriod);
  const [comparison, setComparison] =
    useState<RankingComparison>(initialComparison);
  const [state, setState] = useState(initialState);
  const [party, setParty] = useState(initialParty);
  const [order, setOrder] = useState<RankingOrder>("score");
  const [direction, setDirection] = useState<RankingDirection>("desc");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const periodDefinition = getRankingPeriod(snapshot, period);
  const periodDeputies = useMemo(
    () => materializePeriod(snapshot, period),
    [period, snapshot],
  );
  const states = useMemo(
    () =>
      Array.from(new Set(periodDeputies.map((deputy) => deputy.state))).sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [periodDeputies],
  );
  const parties = useMemo(
    () =>
      Array.from(new Set(periodDeputies.map((deputy) => deputy.party))).sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [periodDeputies],
  );
  const cohort = useMemo(
    () =>
      filterRankingCohort(periodDeputies, state, party),
    [party, periodDeputies, state],
  );

  const ranked = useMemo<AnyRankedDeputy[]>(() => {
    const result: AnyRankedDeputy[] =
      index === "public-value"
        ? calculatePublicValueRanking(periodDeputies).filter(
            (deputy) =>
              (state === "all" || deputy.state === state) &&
              (party === "all" || deputy.party === party),
          )
        : calculateRanking(cohort);
    return [...result].sort((a, b) => {
      const difference =
        order === "name"
          ? a.name.localeCompare(b.name, "pt-BR")
          : dimensionValue(a, order) - dimensionValue(b, order);
      const directed = direction === "asc" ? difference : -difference;
      return directed || a.name.localeCompare(b.name, "pt-BR");
    });
  }, [cohort, direction, index, order, party, periodDeputies, state]);

  const previousPeriod = comparisonPeriod(snapshot, period, comparison);
  const previousRanked = useMemo(() => {
    if (!previousPeriod) return null;
    const previousDeputies = materializePeriod(snapshot, previousPeriod.id);
    if (index === "public-value") {
      return calculatePublicValueRanking(previousDeputies).filter(
        (deputy) =>
          (state === "all" || deputy.state === state) &&
          (party === "all" || deputy.party === party),
      );
    }
    return calculateRanking(
      filterRankingCohort(previousDeputies, state, party),
    );
  }, [index, party, previousPeriod, snapshot, state]);
  const rankChanges = useMemo(
    () =>
      calculateRankChanges(
        ranked,
        previousRanked,
        previousPeriod?.label || null,
      ),
    [previousPeriod?.label, previousRanked, ranked],
  );

  const searched = useMemo(() => {
    return searchRankedDeputies(ranked, query);
  }, [query, ranked]);

  const eligible = ranked.filter((deputy) => deputy.eligible);
  const average =
    eligible.length === 0
      ? null
      : Math.round(
          eligible.reduce((sum, deputy) => sum + (deputy.score || 0), 0) /
            eligible.length,
        );
  const contextQuery = useMemo(() => {
    const context = new URLSearchParams();
    context.set("indice", index === "public-value" ? "valor-publico" : "atual");
    context.set("periodo", period);
    if (comparison === "previous-year") {
      context.set("comparacao", "ano-a-ano");
    }
    if (state !== "all") context.set("uf", state);
    if (party !== "all") context.set("partido", party);
    return `?${context.toString()}`;
  }, [comparison, index, party, period, state]);

  useEffect(() => {
    router.replace(`${pathname}${contextQuery}`, { scroll: false });
  }, [contextQuery, pathname, router]);

  const reset = () => {
    setPeriod(defaultRankingPeriod(snapshot).id);
    setComparison("legislature-start");
    setIndex("current");
    setState("all");
    setParty("all");
    setOrder("score");
    setDirection("desc");
    setVisible(PAGE_SIZE);
  };

  const filters = (
    <RankingFilters
      index={index}
      period={period}
      comparison={comparison}
      state={state}
      party={party}
      order={order}
      periods={snapshot.periods.map(({ id, label, partial, end }) => ({
        id,
        label,
        partial,
        end,
      }))}
      states={states}
      parties={parties}
      onIndexChange={(value) => {
        setIndex(value);
        setOrder("score");
        setDirection("desc");
        setVisible(PAGE_SIZE);
      }}
      onPeriodChange={(value) => {
        setPeriod(value);
        setState("all");
        setParty("all");
        setVisible(PAGE_SIZE);
      }}
      onComparisonChange={setComparison}
      onStateChange={(value) => {
        setState(value);
        setVisible(PAGE_SIZE);
      }}
      onPartyChange={(value) => {
        setParty(value);
        setVisible(PAGE_SIZE);
      }}
      onOrderChange={(value) => {
        setOrder(value);
        setDirection(value === "name" ? "asc" : "desc");
        setVisible(PAGE_SIZE);
      }}
      onReset={reset}
    />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <Card className="sticky top-24">
          <CardContent>{filters}</CardContent>
        </Card>
      </aside>

      <div className="min-w-0">
        <div className="mb-5 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisible(PAGE_SIZE);
              }}
              className="h-10 pl-9"
              placeholder="Buscar por nome, número ou partido"
              aria-label="Buscar deputado"
            />
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <Button
              variant="outline"
              className="lg:hidden"
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="size-4" /> Filtros
            </Button>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Filtrar ranking</SheetTitle>
              </SheetHeader>
              <div className="px-4">{filters}</div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Summary label="Deputados no grupo" value={cohort.length} />
          <Summary label="Com posição" value={eligible.length} />
          <Summary
            label="Score médio"
            value={average ?? "N/D"}
            suffix="/100"
            score={average}
            index={index}
          />
          <Summary
            label="Atualizado em"
            value={new Intl.DateTimeFormat("pt-BR").format(
              new Date(`${periodDefinition.end}T12:00:00`),
            )}
          />
        </div>

        {index === "public-value" && (
          <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            <p className="font-medium">Valor Público experimental</p>
            <p className="mt-1 text-xs leading-5">
              A nota usa contribuição temática classificada, eficiência por gasto,
              participação e cobertura de dados. Propostas pendentes de revisão não
              recebem zero; votações ambíguas também ficam fora das penalidades
              automáticas.
            </p>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">
              {state === "all" ? "Brasil" : state}
              {party === "all" ? "" : ` · ${party}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {searched.length} resultados · {periodDefinition.label}
              {periodDefinition.partial
                ? `, dados até ${new Intl.DateTimeFormat("pt-BR").format(
                    new Date(`${periodDefinition.end}T12:00:00`),
                  )}`
                : ""}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Fonte: Câmara dos Deputados e TSE
          </p>
        </div>

        <RankingTable
          deputies={searched.slice(0, visible)}
          index={index}
          order={order}
          direction={direction}
          onOrderChange={(value) => {
            if (value === order) {
              setDirection((current) =>
                current === "desc" ? "asc" : "desc",
              );
            } else {
              setOrder(value);
              setDirection(value === "name" ? "asc" : "desc");
            }
            setVisible(PAGE_SIZE);
          }}
          contextQuery={contextQuery}
          rankChanges={rankChanges}
        />

        {visible < searched.length && (
          <Button
            variant="outline"
            className="mt-5 w-full"
            onClick={() => setVisible((current) => current + PAGE_SIZE)}
          >
            Mostrar mais deputados
          </Button>
        )}
      </div>
    </div>
  );
}

function dimensionValue(deputy: AnyRankedDeputy, order: RankingOrder) {
  if (order === "score") return deputy.score ?? -1;
  if (order === "name") return 0;
  if (order === "participation") return deputy.dimensions.participation ?? -1;
  if (order === "transparency") return deputy.dimensions.transparency;
  if (order === "production" && "production" in deputy.dimensions) {
    return deputy.dimensions.production ?? -1;
  }
  if (order === "resources" && "resources" in deputy.dimensions) {
    return deputy.dimensions.resources ?? -1;
  }
  if (order === "contribution" && "contribution" in deputy.dimensions) {
    return deputy.dimensions.contribution ?? -1;
  }
  if (order === "publicVotes" && "publicVotes" in deputy.dimensions) {
    return deputy.dimensions.publicVotes ?? -1;
  }
  if (order === "efficiency" && "efficiency" in deputy.dimensions) {
    return deputy.dimensions.efficiency ?? -1;
  }
  return -1;
}

function Summary({
  label,
  value,
  suffix,
  score,
  index = "current",
}: {
  label: string;
  value: string | number;
  suffix?: string;
  score?: number | null;
  index?: RankingIndex;
}) {
  const style = score === undefined ? null : scoreStyle(score, index);
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3",
        style && style.soft,
        style && style.border,
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", style?.text)}>
        {value}
        {suffix && <span className="text-xs font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );
}
