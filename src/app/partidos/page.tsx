import { PartyRankingBrowser } from "@/components/party-ranking-browser";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { getFullSnapshot } from "@/lib/db";
import { defaultRankingPeriod, getRankingPeriod } from "@/lib/ranking";

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string;
  }>;
}) {
  const context = await searchParams;
  const snapshot = await getFullSnapshot();
  const requestedPeriod = context.periodo || defaultRankingPeriod(snapshot).id;
  const period = getRankingPeriod(snapshot, requestedPeriod);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-5 max-w-4xl">
            <Badge variant="secondary">Agregado por partido</Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Ranking de partidos
            </h1>
            <p className="mt-2 text-muted-foreground text-pretty">
              Compare os partidos pela média de Valor Público dos seus
              deputados federais que entram no ranking no período selecionado.
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground text-pretty">
              O score do partido é uma agregação do ranking dos candidatos. Ele
              não mede ideologia, histórico eleitoral ou posição oficial da
              legenda.
            </p>
          </div>

          <PartyRankingBrowser
            snapshot={snapshot}
            initialPeriod={period.id}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
