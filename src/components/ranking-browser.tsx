"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  calculatePublicValueRanking,
  calculateRankChanges,
  defaultRankingPeriod,
  comparisonPeriod,
  getRankingPeriod,
  materializePeriod,
  periodSelectOrder,
  searchRankedDeputies,
  type PublicValueRankedDeputy,
  type RankingComparison,
  type RankingIndex,
  type RankingSnapshot,
} from "@/lib/ranking";
import { scoreStyle } from "@/lib/score-style";
import { cn } from "@/lib/utils";
import { RankingFilters, type RankingOrder } from "./ranking-filters";
import { RankingTable } from "./ranking-table";

const PAGE_SIZE = 20;

export function RankingBrowser({
  snapshot,
  initialState = "all",
  initialParty = "all",
  initialPeriod,
  initialComparison = "legislature-start",
}: {
  snapshot: RankingSnapshot;
  initialState?: string;
  initialParty?: string;
  initialPeriod: string;
  initialComparison?: RankingComparison;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const index: RankingIndex = "public-value";
  const [period, setPeriod] = useState(initialPeriod);
  const [comparison, setComparison] =
    useState<RankingComparison>(initialComparison);
  const [state, setState] = useState(initialState);
  const [party, setParty] = useState(initialParty);
  const [order, setOrder] = useState<RankingOrder>("score");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
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

  const ranked = useMemo(() => {
    const result = calculatePublicValueRanking(periodDeputies).filter(
      (deputy) =>
        (state === "all" || deputy.state === state) &&
        (party === "all" || deputy.party === party),
    );
    return [...result].sort((a, b) => {
      const difference =
        order === "name"
          ? a.name.localeCompare(b.name, "pt-BR")
          : dimensionValue(a, order) - dimensionValue(b, order);
      const directed = direction === "asc" ? difference : -difference;
      return directed || a.name.localeCompare(b.name, "pt-BR");
    });
  }, [direction, order, party, periodDeputies, state]);

  const previousPeriod = comparisonPeriod(snapshot, period, comparison);
  const previousRanked = useMemo(() => {
    if (!previousPeriod) return null;
    return calculatePublicValueRanking(
      materializePeriod(snapshot, previousPeriod.id),
    ).filter(
      (deputy) =>
        (state === "all" || deputy.state === state) &&
        (party === "all" || deputy.party === party),
    );
  }, [party, previousPeriod, snapshot, state]);
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
    context.set("periodo", period);
    if (comparison === "previous-year") {
      context.set("comparacao", "ano-a-ano");
    }
    if (state !== "all") context.set("uf", state);
    if (party !== "all") context.set("partido", party);
    return `?${context.toString()}`;
  }, [comparison, party, period, state]);

  useEffect(() => {
    router.replace(`${pathname}${contextQuery}`, { scroll: false });
  }, [contextQuery, pathname, router]);

  const reset = () => {
    setPeriod(defaultRankingPeriod(snapshot).id);
    setComparison("legislature-start");
    setState("all");
    setParty("all");
    setOrder("score");
    setDirection("desc");
    setVisible(PAGE_SIZE);
  };

  const filterPeriods = periodSelectOrder(
    snapshot.periods.map(({ id, label, partial, end }) => ({
      id,
      label,
      partial,
      end,
    })),
  );

  const filters = (
    <RankingFilters
      index={index}
      period={period}
      comparison={comparison}
      state={state}
      party={party}
      order={order}
      periods={filterPeriods}
      states={states}
      parties={parties}
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
    <div className="min-w-0 space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Deputados no grupo" value={periodDeputies.length} />
        <Summary label="Com posição" value={eligible.length} />
        <Summary
          label="Score médio"
          value={average ?? "N/D"}
          suffix="/100"
          score={average}
        />
        <Summary
          label="Atualizado em"
          value={new Intl.DateTimeFormat("pt-BR").format(
            new Date(`${periodDefinition.end}T12:00:00`),
          )}
        />
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-3 shadow-xs">
        <div className="flex gap-2">
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
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" className="h-10">
                  <Filter className="size-4" /> Filtros
                </Button>
              }
            />
            <PopoverContent align="end" className="w-[calc(100vw-2rem)] sm:w-96">
              {filters}
            </PopoverContent>
          </Popover>
        </div>

        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
          Posições e notas são nacionais; estado e partido apenas filtram a lista.
          A busca por nome apenas localiza o parlamentar.
        </p>
      </div>

      <div className="min-w-0">
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

function dimensionValue(deputy: PublicValueRankedDeputy, order: RankingOrder) {
  if (order === "score") return deputy.score ?? -1;
  if (order === "name") return 0;
  if (order === "participation") return deputy.dimensions.participation ?? -1;
  if (order === "campaignFinance") return deputy.dimensions.campaignFinance ?? -1;
  if (order === "contribution") return deputy.dimensions.contribution ?? -1;
  if (order === "publicVotes") return deputy.dimensions.publicVotes ?? -1;
  if (order === "efficiency") return deputy.dimensions.efficiency ?? -1;
  return -1;
}

function Summary({
  label,
  value,
  suffix,
  score,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  score?: number | null;
}) {
  const style = score === undefined ? null : scoreStyle(score, "public-value");
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
