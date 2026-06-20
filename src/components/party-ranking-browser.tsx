"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { DimensionScore } from "@/components/dimension-score";
import { SemanticScore } from "@/components/semantic-score";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calculatePartyRankingForPeriod,
  defaultRankingPeriod,
  getRankingPeriod,
  periodSelectOrder,
  type PartyRankedRecord,
  type RankingSnapshot,
} from "@/lib/ranking";
import { PUBLIC_VALUE_DIMENSION_LABELS } from "@/lib/public-value";
import { scoreStyle } from "@/lib/score-style";
import { cn } from "@/lib/utils";

export function PartyRankingBrowser({
  snapshot,
  initialPeriod,
}: {
  snapshot: RankingSnapshot;
  initialPeriod: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [period, setPeriod] = useState(initialPeriod);
  const periodDefinition = getRankingPeriod(snapshot, period);
  const parties = useMemo(
    () => calculatePartyRankingForPeriod(snapshot, period),
    [period, snapshot],
  );
  const rankedParties = parties.filter((party) => party.score !== null);
  const rankedDeputies = parties.reduce(
    (sum, party) => sum + party.deputiesRanked,
    0,
  );
  const average =
    rankedParties.length === 0
      ? null
      : Math.round(
          rankedParties.reduce((sum, party) => sum + (party.score ?? 0), 0) /
            rankedParties.length,
        );
  const periods = periodSelectOrder(
    snapshot.periods.map(({ id, label, partial, end }) => ({
      id,
      label,
      partial,
      end,
    })),
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("periodo", period);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, period, router]);

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Partidos" value={parties.length} />
        <Summary label="Deputados no ranking" value={rankedDeputies} />
        <Summary
          label="Score médio dos partidos"
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

      <div className="rounded-lg border bg-card p-3 shadow-xs">
        <label className="block space-y-2 text-xs font-medium text-muted-foreground">
          <span>Período</span>
          <Select
            value={period}
            onValueChange={(value) =>
              setPeriod(value ?? defaultRankingPeriod(snapshot).id)
            }
          >
            <SelectTrigger className="w-full sm:w-72">
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
        </label>
        <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
          O ranking de partidos agrega o Valor Público dos deputados do partido
          no período selecionado. Não é uma análise independente da legenda.
        </p>
      </div>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Partidos</h2>
            <p className="text-sm text-muted-foreground">
              {parties.length} partidos · {periodDefinition.label}
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

        <PartyRankingTable parties={parties} />
      </div>
    </div>
  );
}

function PartyRankingTable({ parties }: { parties: PartyRankedRecord[] }) {
  if (parties.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center text-center">
        <BarChart3 className="mb-3 size-8 text-muted-foreground" />
        <p className="font-medium">Nenhum partido encontrado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Não há deputados materializados para este período.
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
              <TableHead className="w-16 text-center">#</TableHead>
              <TableHead className="w-36">Partido</TableHead>
              <TableHead className="w-24 text-center">Score</TableHead>
              <TableHead className="w-36 text-center">Deputados</TableHead>
              <TableHead>Dimensões</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parties.map((party) => (
              <TableRow key={party.party}>
                <TableCell className="text-center">
                  <p className="text-xl font-semibold tabular-nums">
                    {party.rank ?? "-"}
                  </p>
                </TableCell>
                <TableCell>
                  <PartyIdentity party={party} />
                </TableCell>
                <TableCell className="text-center">
                  <SemanticScore
                    value={party.score}
                    index="public-value"
                    compact
                  />
                </TableCell>
                <TableCell className="text-center">
                  <BenchCount party={party} />
                </TableCell>
                <TableCell>
                  <PartyDimensions party={party} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid min-w-0 gap-4 lg:hidden">
        {parties.map((party) => (
          <article
            key={party.party}
            className="min-w-0 overflow-hidden rounded-lg border bg-card p-4 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <p className="w-8 shrink-0 pt-1 text-center text-xl font-semibold tabular-nums">
                {party.rank ?? "-"}
              </p>
              <div className="min-w-0 flex-1">
                <PartyIdentity party={party} />
              </div>
              <SemanticScore value={party.score} index="public-value" compact />
            </div>
            <div className="mt-3 pl-11">
              <BenchCount party={party} inline />
            </div>
            <PartyDimensions party={party} className="mt-5" />
          </article>
        ))}
      </div>
    </>
  );
}

function PartyIdentity({ party }: { party: PartyRankedRecord }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-lg font-semibold">{party.party}</p>
      <p className="truncate text-xs text-muted-foreground">
        Média dos deputados no ranking
      </p>
    </div>
  );
}

function BenchCount({
  party,
  inline = false,
}: {
  party: PartyRankedRecord;
  inline?: boolean;
}) {
  const content = (
    <>
      <span className="font-semibold tabular-nums text-foreground">
        {party.deputiesRanked} de {party.deputiesTotal}
      </span>
      <span>{inline ? " deputados no ranking" : "no ranking"}</span>
    </>
  );

  if (inline) {
    return (
      <span className="inline-flex items-baseline gap-1 text-xs text-muted-foreground">
        {content}
      </span>
    );
  }

  return (
    <div className="leading-tight">
      <p className="flex flex-col items-center gap-0.5 text-sm">
        {content}
      </p>
    </div>
  );
}

function PartyDimensions({
  party,
  className,
}: {
  party: PartyRankedRecord;
  className?: string;
}) {
  const items = [
    {
      key: "participation",
      label: "Part.",
      value: party.dimensions.participation,
    },
    {
      key: "contribution",
      label: PUBLIC_VALUE_DIMENSION_LABELS.contribution,
      value: party.dimensions.contribution,
    },
    {
      key: "publicVotes",
      label: PUBLIC_VALUE_DIMENSION_LABELS.publicVotes,
      value: party.dimensions.publicVotes,
    },
    {
      key: "efficiency",
      label: "Fin.",
      value: party.dimensions.efficiency,
    },
    {
      key: "campaignFinance",
      label: "Camp.",
      value: party.dimensions.campaignFinance,
    },
  ];

  return (
    <div
      className={cn(
        "grid min-w-0 gap-2 min-[560px]:grid-cols-5",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.key} className="min-w-0 rounded-md px-2 py-1.5">
          <DimensionScore
            label={item.label}
            value={item.value}
            index="public-value"
            compact
            compactBar
            showCompactLabel
            compactValueAlign="right"
          />
        </div>
      ))}
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
        {suffix && (
          <span className="text-xs font-normal text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}
