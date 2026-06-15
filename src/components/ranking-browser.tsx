"use client";

import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  calculateRanking,
  filterRankingCohort,
  searchRankedDeputies,
  type RankingSnapshot,
} from "@/lib/ranking";
import { scoreStyle } from "@/lib/score-style";
import { cn } from "@/lib/utils";
import { RankingFilters, type RankingOrder } from "./ranking-filters";
import { RankingTable } from "./ranking-table";

const PAGE_SIZE = 20;

export function RankingBrowser({
  snapshot,
  states,
  parties,
  initialState = "all",
  initialParty = "all",
}: {
  snapshot: RankingSnapshot;
  states: string[];
  parties: string[];
  initialState?: string;
  initialParty?: string;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState(initialState);
  const [party, setParty] = useState(initialParty);
  const [order, setOrder] = useState<RankingOrder>("score");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const cohort = useMemo(
    () =>
      filterRankingCohort(snapshot.deputies, state, party),
    [party, snapshot.deputies, state],
  );

  const ranked = useMemo(() => {
    const result = calculateRanking(cohort);
    if (order === "score") return result;
    return [...result].sort((a, b) => {
      const difference =
        (b.dimensions[order] ?? -1) - (a.dimensions[order] ?? -1);
      return difference || a.name.localeCompare(b.name, "pt-BR");
    });
  }, [cohort, order]);

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
  const context = new URLSearchParams();
  if (state !== "all") context.set("uf", state);
  if (party !== "all") context.set("partido", party);
  const contextQuery = context.size ? `?${context.toString()}` : "";

  const reset = () => {
    setState("all");
    setParty("all");
    setOrder("score");
    setVisible(PAGE_SIZE);
  };

  const filters = (
    <RankingFilters
      state={state}
      party={party}
      order={order}
      states={states}
      parties={parties}
      onStateChange={(value) => {
        setState(value);
        setVisible(PAGE_SIZE);
      }}
      onPartyChange={(value) => {
        setParty(value);
        setVisible(PAGE_SIZE);
      }}
      onOrderChange={setOrder}
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
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" className="lg:hidden">
                  <Filter className="size-4" /> Filtros
                </Button>
              }
            />
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
          />
          <Summary
            label="Atualizado em"
            value={new Intl.DateTimeFormat("pt-BR").format(
              new Date(`${snapshot.period.end}T12:00:00`),
            )}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">
              {state === "all" ? "Brasil" : state}
              {party === "all" ? "" : ` · ${party}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {searched.length} resultados · legislatura atual
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Fonte: Câmara dos Deputados e TSE
          </p>
        </div>

        <RankingTable
          deputies={searched.slice(0, visible)}
          contextQuery={contextQuery}
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
  const style = score === undefined ? null : scoreStyle(score);
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
