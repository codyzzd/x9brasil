"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RankingComparison, RankingIndex } from "@/lib/ranking";
import { cn } from "@/lib/utils";

export type RankingOrder =
  | "score"
  | "name"
  | "participation"
  | "production"
  | "resources"
  | "contribution"
  | "publicVotes"
  | "efficiency"
  | "campaignFinance";

export function RankingFilters({
  index,
  period,
  comparison,
  state,
  party,
  order,
  periods,
  states,
  parties,
  onPeriodChange,
  onComparisonChange,
  onStateChange,
  onPartyChange,
  onOrderChange,
  onReset,
  layout = "panel",
}: {
  index: RankingIndex;
  period: string;
  comparison: RankingComparison;
  state: string;
  party: string;
  order: RankingOrder;
  periods: Array<{ id: string; label: string; partial: boolean; end: string }>;
  states: string[];
  parties: string[];
  onPeriodChange: (value: string) => void;
  onComparisonChange: (value: RankingComparison) => void;
  onStateChange: (value: string) => void;
  onPartyChange: (value: string) => void;
  onOrderChange: (value: RankingOrder) => void;
  onReset: () => void;
  layout?: "panel" | "toolbar";
}) {
  const toolbar = layout === "toolbar";

  return (
    <div
      className={cn(
        toolbar
          ? "rounded-lg border bg-card p-3 shadow-xs"
          : "space-y-5",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Filtros</h2>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="size-3.5" /> Limpar
        </Button>
      </div>

      <div
        className={cn(
          toolbar
            ? "mt-3 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3"
            : "space-y-5",
        )}
      >
        <FilterField label="Período" toolbar={toolbar}>
          <Select
            value={period}
            onValueChange={(value) => onPeriodChange(value ?? periods[0]?.id ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {periods.find((item) => item.id === period)?.label || period}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {periods.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Comparar posição com" toolbar={toolbar}>
          <Select
            value={comparison}
            disabled={!/^\d{4}$/.test(period)}
            onValueChange={(value) =>
              onComparisonChange(
                (value ?? "legislature-start") as RankingComparison,
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {comparison === "previous-year"
                  ? "Ano anterior"
                  : `Início da legislatura (${firstAnnualPeriod(periods)})`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="legislature-start">
                Início da legislatura ({firstAnnualPeriod(periods)})
              </SelectItem>
              <SelectItem value="previous-year">Ano anterior</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Estado" toolbar={toolbar}>
          <Select value={state} onValueChange={(value) => onStateChange(value ?? "all")}>
            <SelectTrigger className="w-full">
              <SelectValue>{state === "all" ? "Todo o Brasil" : state}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o Brasil</SelectItem>
              {states.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Partido" toolbar={toolbar}>
          <Select value={party} onValueChange={(value) => onPartyChange(value ?? "all")}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {party === "all" ? "Todos os partidos" : party}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os partidos</SelectItem>
              {parties.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Ordenar por" toolbar={toolbar}>
          <Select
            value={order}
            onValueChange={(value) => onOrderChange((value ?? "score") as RankingOrder)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {orderLabel(order, index)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">
                {index === "public-value" ? "Valor Público" : "Score geral"}
              </SelectItem>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="participation">Participação</SelectItem>
              {index === "current" ? (
                <>
                  <SelectItem value="production">Produção</SelectItem>
                  <SelectItem value="resources">Uso de recursos</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="contribution">Contribuição pública</SelectItem>
                  <SelectItem value="publicVotes">Votos públicos</SelectItem>
                  <SelectItem value="efficiency">Eficiência financeira</SelectItem>
                </>
              )}
              <SelectItem value="campaignFinance">Finanças de campanha</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      <div
        className={cn(
          "text-xs leading-5 text-muted-foreground",
          toolbar
            ? "mt-3 rounded-md bg-muted/60 px-3 py-2"
            : "rounded-lg bg-muted p-4",
        )}
      >
        Posições e notas são nacionais; estado e partido apenas filtram a lista.
        A busca por nome apenas localiza o parlamentar.
      </div>
    </div>
  );
}

function firstAnnualPeriod(
  periods: Array<{ id: string; label: string; partial: boolean; end: string }>,
) {
  return (
    periods
      .filter((period) => /^\d{4}$/.test(period.id))
      .sort((a, b) => Number(a.id) - Number(b.id))[0]?.label || "indisponível"
  );
}

function orderLabel(order: RankingOrder, index: RankingIndex) {
  return {
    score: index === "public-value" ? "Valor Público" : "Score geral",
    name: "Nome",
    participation: "Participação",
    production: "Produção",
    resources: "Uso de recursos",
    contribution: "Contribuição pública",
    publicVotes: "Votos públicos",
    efficiency: "Eficiência financeira",
    campaignFinance: "Finanças de campanha",
  }[order];
}

function FilterField({
  label,
  toolbar = false,
  children,
}: {
  label: string;
  toolbar?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block space-y-2 font-medium", toolbar ? "text-xs" : "text-sm")}>
      <span className={toolbar ? "text-muted-foreground" : undefined}>{label}</span>
      {children}
    </label>
  );
}
