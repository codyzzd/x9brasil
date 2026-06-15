import { Info } from "lucide-react";
import { RankingBrowser } from "@/components/ranking-browser";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import {
  getPeriodFacets,
  rankingSnapshot,
  resolvePeriod,
} from "@/lib/data";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    uf?: string;
    partido?: string;
    periodo?: string;
    indice?: string;
    comparacao?: string;
  }>;
}) {
  const context = await searchParams;
  const initialIndex =
    context.indice === "valor-publico" ? "public-value" : "current";
  const initialPeriod = resolvePeriod(context.periodo);
  const initialComparison =
    context.comparacao === "ano-a-ano" ? "previous-year" : "legislature-start";
  const { states, parties } = getPeriodFacets(initialPeriod.id);
  const initialState = context.uf && states.includes(context.uf) ? context.uf : "all";
  const initialParty =
    context.partido && parties.includes(context.partido) ? context.partido : "all";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <Badge variant="secondary">Dados públicos oficiais</Badge>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Ranking de deputados federais
              </h1>
              <p className="mt-2 max-w-3xl text-muted-foreground text-pretty">
                Compare participação, produção legislativa, uso de recursos e
                transparência na legislatura iniciada em 1º de fevereiro de 2023.
              </p>
            </div>
            <div className="flex max-w-md gap-2 rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>
                O score é comparativo e informativo. Ele não mede ideologia,
                honestidade ou intenção de voto.
              </p>
            </div>
          </div>
          <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span className="font-medium text-muted-foreground">Escala:</span>
            {initialIndex === "public-value" ? (
              <>
                <Legend color="bg-red-500" label="Muito baixo · 0–39" />
                <Legend color="bg-orange-500" label="Baixo · 40–59" />
                <Legend color="bg-amber-500" label="Médio · 60–74" />
                <Legend color="bg-emerald-400" label="Alto · 75–89" />
                <Legend color="bg-emerald-500" label="Excelente · 90–100" />
              </>
            ) : (
              <>
                <Legend color="bg-red-500" label="Baixo · 0–49" />
                <Legend color="bg-amber-500" label="Médio · 50–64" />
                <Legend color="bg-emerald-500" label="Bom · 65–100" />
              </>
            )}
            <Legend color="bg-muted-foreground" label="Dados indisponíveis" />
          </div>
          <RankingBrowser
            snapshot={rankingSnapshot}
            initialIndex={initialIndex}
            initialState={initialState}
            initialParty={initialParty}
            initialPeriod={initialPeriod.id}
            initialComparison={initialComparison}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={`size-2.5 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}
