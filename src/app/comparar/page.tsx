import type { Metadata } from "next";
import { CandidateComparison } from "@/components/candidate-comparison";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { buildComparisonCandidate } from "@/lib/comparison";
import {
  getFullSnapshot,
  getProfileDetails,
  getPeriodOptions,
  getSnapshotMetadata,
} from "@/lib/db";
import {
  calculatePublicValueRanking,
  defaultRankingPeriod,
  materializePeriod,
  periodSelectOrder,
} from "@/lib/ranking";

export const metadata: Metadata = {
  title: "Comparar candidatos",
  description:
    "Compare atividade legislativa, uso de recursos e dados públicos de dois deputados federais no Score Brasil.",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{
    a?: string;
    b?: string;
    periodo?: string;
  }>;
}) {
  const context = await searchParams;
  const snapshot = await getFullSnapshot();
  const metadata = await getSnapshotMetadata();
  const period = snapshot.periods.find(
    (p) => p.id === (context.periodo || defaultRankingPeriod(snapshot).id),
  ) || snapshot.periods[0];
  const periodDeputies = materializePeriod(snapshot, period.id);
  const ranked = calculatePublicValueRanking(periodDeputies);
  const bySlug = new Map(ranked.map((candidate) => [candidate.slug, candidate]));
  const rankedA = context.a ? bySlug.get(context.a) || null : null;
  const rankedB =
    context.b && context.b !== context.a
      ? bySlug.get(context.b) || null
      : null;

  const candidateA = rankedA
    ? buildComparisonCandidate(
        rankedA,
        "public-value",
        await getProfileDetails(rankedA.id, period.id),
      )
    : null;
  const candidateB = rankedB
    ? buildComparisonCandidate(
        rankedB,
        "public-value",
        await getProfileDetails(rankedB.id, period.id),
      )
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-7">
            <Badge variant="secondary">Dados públicos oficiais</Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Comparador de candidatos
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground text-pretty">
              Coloque dois deputados lado a lado para comparar desempenho,
              atividade parlamentar, uso da cota, emendas, patrimônio e equipe.
            </p>
          </div>

          <CandidateComparison
            options={periodDeputies
              .map((candidate) => ({
                slug: candidate.slug,
                name: candidate.name,
                civilName: candidate.civilName,
                party: candidate.party,
                state: candidate.state,
                electionNumber: candidate.electionNumber,
              }))
              .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))}
            periods={periodSelectOrder((await getPeriodOptions()).map(({ id, label, partial }) => ({
              id,
              label,
              partial,
            })))}
            period={period.id}
            index="public-value"
            selectedA={context.a || null}
            selectedB={context.b || null}
            candidateA={candidateA}
            candidateB={candidateB}
            invalidA={Boolean(context.a && !rankedA)}
            invalidB={Boolean(
              context.b && (!bySlug.has(context.b) || context.b === context.a),
            )}
          />

        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
