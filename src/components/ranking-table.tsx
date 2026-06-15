"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";
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
  type RankedDeputy,
} from "@/lib/ranking";
import { cn } from "@/lib/utils";
import { DimensionScore } from "./dimension-score";
import { SemanticScore } from "./semantic-score";

export function RankingTable({
  deputies,
  contextQuery,
}: {
  deputies: RankedDeputy[];
  contextQuery: string;
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
              <TableHead className="w-16 text-center">#</TableHead>
              <TableHead>Deputado</TableHead>
              <TableHead className="min-w-28">Participação</TableHead>
              <TableHead className="min-w-28">Produção</TableHead>
              <TableHead className="min-w-28">Recursos</TableHead>
              <TableHead className="min-w-28">Transparência</TableHead>
              <TableHead className="w-28 text-center">Score</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deputies.map((deputy) => (
              <TableRow key={deputy.id}>
                <TableCell className="text-center text-xl font-semibold tabular-nums">
                  {deputy.rank ?? "—"}
                </TableCell>
                <TableCell>
                  <DeputyIdentity deputy={deputy} />
                </TableCell>
                <TableCell>
                  <DimensionScore
                    label={`${deputy.metrics.plenaryAttendances ?? "N/D"} sessões`}
                    value={deputy.dimensions.participation}
                    compact
                  />
                </TableCell>
                <TableCell>
                  <DimensionScore
                    label={`${deputy.metrics.substantiveProposals ?? "N/D"} propostas`}
                    value={deputy.dimensions.production}
                    compact
                  />
                </TableCell>
                <TableCell>
                  <DimensionScore
                    label={formatCurrency(deputy.metrics.expensesTotal)}
                    value={deputy.dimensions.resources}
                    compact
                  />
                </TableCell>
                <TableCell>
                  <DimensionScore
                    label="dados oficiais"
                    value={deputy.dimensions.transparency}
                    compact
                  />
                </TableCell>
                <TableCell className="text-center">
                  <SemanticScore value={deputy.score} compact />
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

      <div className="grid gap-4 lg:hidden">
        {deputies.map((deputy) => (
          <article key={deputy.id} className="rounded-lg border bg-card p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <p className="w-8 shrink-0 pt-1 text-center text-xl font-semibold tabular-nums">
                {deputy.rank ?? "—"}
              </p>
              <div className="min-w-0 flex-1">
                <DeputyIdentity deputy={deputy} />
              </div>
              <SemanticScore value={deputy.score} compact />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <DimensionScore
                label="Participação"
                value={deputy.dimensions.participation}
              />
              <DimensionScore label="Produção" value={deputy.dimensions.production} />
              <DimensionScore label="Recursos" value={deputy.dimensions.resources} />
              <DimensionScore
                label="Transparência"
                value={deputy.dimensions.transparency}
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

function DeputyIdentity({ deputy }: { deputy: RankedDeputy }) {
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

function labelStyle(label: string) {
  if (
    label.includes("alta") ||
    label.includes("equilibrado")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400";
  }
  if (
    label.includes("abaixo") ||
    label.includes("concentrados") ||
    label.includes("incompletos")
  ) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400";
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400";
}
