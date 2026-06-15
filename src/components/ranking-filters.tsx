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

export type RankingOrder = "score" | "participation" | "production" | "resources";

export function RankingFilters({
  state,
  party,
  order,
  states,
  parties,
  onStateChange,
  onPartyChange,
  onOrderChange,
  onReset,
}: {
  state: string;
  party: string;
  order: RankingOrder;
  states: string[];
  parties: string[];
  onStateChange: (value: string) => void;
  onPartyChange: (value: string) => void;
  onOrderChange: (value: RankingOrder) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Filtros</h2>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="size-3.5" /> Limpar
        </Button>
      </div>
      <FilterField label="Estado">
        <Select value={state} onValueChange={(value) => onStateChange(value ?? "all")}>
          <SelectTrigger className="w-full">
            <SelectValue />
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
      <FilterField label="Partido">
        <Select value={party} onValueChange={(value) => onPartyChange(value ?? "all")}>
          <SelectTrigger className="w-full">
            <SelectValue />
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
      <FilterField label="Ordenar por">
        <Select
          value={order}
          onValueChange={(value) => onOrderChange((value ?? "score") as RankingOrder)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Score geral</SelectItem>
            <SelectItem value="participation">Participação</SelectItem>
            <SelectItem value="production">Produção</SelectItem>
            <SelectItem value="resources">Uso de recursos</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
      <div className="rounded-lg bg-muted p-4 text-xs leading-5 text-muted-foreground">
        Estado e partido recalculam as posições dentro do grupo selecionado. A busca
        por nome apenas localiza o parlamentar e não muda sua nota.
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
