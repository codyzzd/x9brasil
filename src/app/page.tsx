import { RankingBrowser } from "@/components/ranking-browser";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { getFullSnapshot } from "@/lib/db";
import { defaultRankingPeriod } from "@/lib/ranking";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    uf?: string;
    partido?: string;
    periodo?: string;
    comparacao?: string;
  }>;
}) {
  const context = await searchParams;
  const snapshot = await getFullSnapshot();

  const initialComparison =
    context.comparacao === "ano-a-ano" ? "previous-year" : "legislature-start";
  const periodId = context.periodo || defaultRankingPeriod(snapshot).id;
  const initialState = context.uf || "all";
  const initialParty = context.partido || "all";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-5 max-w-4xl">
            <Badge variant="secondary">Dados públicos oficiais</Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Ranking de deputados federais
            </h1>
            <p className="mt-2 text-muted-foreground text-pretty">
              Compare participação, contribuição temática, eficiência e
              transparência na legislatura iniciada em 1º de fevereiro de 2023.
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground text-pretty">
              O score é comparativo e informativo. Ele não mede ideologia,
              honestidade ou intenção de voto.
            </p>
          </div>
          <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span className="font-medium text-muted-foreground">Escala:</span>
            <Legend color="bg-red-500" label="Muito baixo · 0–39" />
            <Legend color="bg-orange-500" label="Baixo · 40–59" />
            <Legend color="bg-amber-500" label="Médio · 60–74" />
            <Legend color="bg-emerald-400" label="Alto · 75–89" />
            <Legend color="bg-emerald-500" label="Excelente · 90–100" />
            <Legend color="bg-muted-foreground" label="Dados indisponíveis" />
          </div>
          <RankingBrowser
            snapshot={snapshot}
            initialState={initialState}
            initialParty={initialParty}
            initialPeriod={periodId}
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
