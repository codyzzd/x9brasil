import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ExternalLink,
  FileCheck2,
  GitCompareArrows,
  Landmark,
  MapPin,
} from "lucide-react";
import {
  AnnualEvolutionChart,
  type AnnualEvolutionPoint,
} from "@/components/annual-evolution-chart";
import { DimensionScore } from "@/components/dimension-score";
import { SemanticScore } from "@/components/semantic-score";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDeputy, rankingSnapshot } from "@/lib/data";
import { dimensionExplanation } from "@/lib/dimension-explanations";
import { getProfileDetails } from "@/lib/profile-data";
import {
  calculatePublicValueRanking,
  calculateRanking,
  calculateRankChanges,
  comparisonPeriod,
  filterRankingCohort,
  formatCurrency,
  getRankingPeriod,
  materializePeriod,
  type PublicValueRankedDeputy,
  type RankChange,
  type RankedDeputy,
  type RankingComparison,
  type RankingIndex,
} from "@/lib/ranking";
import { publicValueClassificationMetadata } from "@/lib/public-value";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    uf?: string;
    partido?: string;
    periodo?: string;
    indice?: string;
    comparacao?: string;
  }>;
};

export function generateStaticParams() {
  return rankingSnapshot.deputies.map(({ slug }) => ({ id: slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const deputy = getDeputy((await params).id);
  return {
    title: deputy?.name ?? "Deputado",
    description: deputy
      ? `Atividade legislativa e dados públicos de ${deputy.name}.`
      : undefined,
  };
}

export default async function DeputyPage({ params, searchParams }: PageProps) {
  const deputy = getDeputy((await params).id);
  if (!deputy) notFound();

  const context = await searchParams;
  const index: RankingIndex =
    context.indice === "valor-publico" ? "public-value" : "current";
  const comparison: RankingComparison =
    context.comparacao === "ano-a-ano" ? "previous-year" : "legislature-start";
  const period = getRankingPeriod(
    rankingSnapshot,
    context.periodo || rankingSnapshot.defaultPeriod,
  );
  const periodDeputies = materializePeriod(rankingSnapshot, period.id);
  const cohort = filterRankingCohort(
    periodDeputies,
    context.uf || "all",
    context.partido || "all",
  );
  const ranked =
    (index === "public-value"
      ? calculatePublicValueRanking(periodDeputies)
      : calculateRanking(cohort)
    ).find((item) => item.id === deputy.id) ||
    calculateRanking(periodDeputies).find((item) => item.id === deputy.id);
  if (!ranked) notFound();
  const profile = getProfileDetails(deputy.id, period.id);
  const identityDetails = profile.identity;
  const periodDetails = profile.period;

  const previousPeriod = comparisonPeriod(
    rankingSnapshot,
    period.id,
    comparison,
  );
  const previousRanked = previousPeriod
    ? index === "public-value"
      ? calculatePublicValueRanking(
          materializePeriod(rankingSnapshot, previousPeriod.id),
        )
      : calculateRanking(
          filterRankingCohort(
            materializePeriod(rankingSnapshot, previousPeriod.id),
            context.uf || "all",
            context.partido || "all",
          ),
        )
    : null;
  const rankChange = calculateRankChanges(
    [ranked],
    previousRanked,
    previousPeriod?.label || null,
  ).get(ranked.id);
  const annualHistory = rankingSnapshot.periods
    .filter((item) => /^\d{4}$/.test(item.id))
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((item) => {
      const itemDeputies = materializePeriod(rankingSnapshot, item.id);
      const itemRanking = (
        index === "public-value"
          ? calculatePublicValueRanking(itemDeputies)
          : calculateRanking(
              filterRankingCohort(
                itemDeputies,
                context.uf || "all",
                context.partido || "all",
              ),
            )
      ).find((candidate) => candidate.id === deputy.id);
      return { period: item, ranked: itemRanking || null };
    });
  const partialAnnualPeriod = annualHistory.find((item) => item.period.partial)?.period;
  const annualChartData: AnnualEvolutionPoint[] = annualHistory.map(
    ({ period: item, ranked: history }) => ({
      year: item.label,
      partial: item.partial,
      rank: history?.rank ?? null,
      score: history?.score ?? null,
      participation: history?.dimensions.participation ?? null,
      production: history
        ? index === "public-value"
          ? profileDimension(history, "contribution")
          : profileDimension(history, "production")
        : null,
      resources: history
        ? index === "public-value"
          ? profileDimension(history, "efficiency")
          : profileDimension(history, "resources")
        : null,
      transparency: history?.dimensions.transparency ?? null,
    }),
  );
  const classificationMetadata = publicValueClassificationMetadata();

  const back = new URLSearchParams();
  back.set("indice", index === "public-value" ? "valor-publico" : "atual");
  back.set("periodo", period.id);
  if (comparison === "previous-year") {
    back.set("comparacao", "ano-a-ano");
  }
  if (context.uf) back.set("uf", context.uf);
  if (context.partido) back.set("partido", context.partido);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href={`/${back.size ? `?${back.toString()}` : ""}`}
            className={cn(buttonVariants({ variant: "ghost" }), "-ml-3 mb-5")}
          >
            <ArrowLeft className="size-4" /> Voltar ao ranking
          </Link>

          <Card>
            <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-muted outline outline-1 -outline-offset-1 outline-black/10">
                <Image
                  src={ranked.photoUrl}
                  alt={`Foto oficial de ${ranked.name}`}
                  fill
                  priority
                  sizes="112px"
                  className="object-cover object-top"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge>{ranked.party}</Badge>
                  <Badge variant="outline">{ranked.state}</Badge>
                  {ranked.electionStatus && (
                    <Badge variant="secondary">{ranked.electionStatus}</Badge>
                  )}
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-balance">
                  {ranked.name}
                </h1>
                <p className="mt-1 text-muted-foreground">{ranked.civilName}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4 text-muted-foreground" />
                    {ranked.state}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    Desde {formatDate(ranked.officeStart)}
                  </span>
                  {ranked.electionNumber && (
                    <span>Número em 2022: {ranked.electionNumber}</span>
                  )}
                  {identityDetails?.birthPlace && (
                    <span>Natural de {identityDetails.birthPlace}</span>
                  )}
                  {identityDetails?.education && (
                    <span>{identityDetails.education}</span>
                  )}
                  {identityDetails?.office && <span>{identityDetails.office}</span>}
                </div>
              </div>
              <div className="text-center sm:min-w-36">
                <p className="text-xs text-muted-foreground">
                  {ranked.rank
                    ? `${ranked.rank}º ${
                        index === "public-value" ? "no Brasil" : "na coorte"
                      }`
                    : "Sem posição"}
                </p>
                <SemanticScore
                  value={ranked.score}
                  index={index}
                  className="mt-2 w-full justify-center"
                />
                <ProfileRankTrend change={rankChange} />
                <Link
                  href={`/comparar?a=${encodeURIComponent(
                    ranked.slug,
                  )}&periodo=${encodeURIComponent(period.id)}&indice=${
                    index === "public-value" ? "valor-publico" : "atual"
                  }`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-4 w-full",
                  )}
                >
                  <GitCompareArrows className="size-3.5" /> Comparar candidato
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6 min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>Evolução anual</CardTitle>
              <CardDescription>
                {index === "public-value"
                  ? "Posição e percentis calculados nacionalmente em cada período."
                  : "Posição e score recalculados na mesma coorte de estado e partido."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnnualEvolutionChart
                data={annualChartData}
                productionLabel={
                  index === "public-value" ? "Contribuição" : "Produção"
                }
                resourcesLabel={
                  index === "public-value" ? "Eficiência" : "Recursos"
                }
              />
              {partialAnnualPeriod && (
                <p className="mt-3 text-xs text-muted-foreground">
                  * Ano em andamento, com dados até{" "}
                  {formatDate(partialAnnualPeriod.end)}.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <Tabs defaultValue="gastos" className="min-w-0">
              <TabsList className="w-full max-w-full justify-start overflow-x-auto">
                <TabsTrigger value="gastos">Gastos da cota</TabsTrigger>
                <TabsTrigger value="fornecedores">Quem recebeu</TabsTrigger>
                <TabsTrigger value="equipe">Equipe</TabsTrigger>
                <TabsTrigger value="producao">Produção legislativa</TabsTrigger>
                <TabsTrigger value="emendas">Emendas</TabsTrigger>
                <TabsTrigger value="patrimonio">Patrimônio</TabsTrigger>
                <TabsTrigger value="fontes">Fontes</TabsTrigger>
              </TabsList>

              <TabsContent value="producao" className="mt-5">
                <div className="space-y-5">
                  <Card>
                  <CardHeader>
                    <CardTitle>Produção legislativa</CardTitle>
                    <CardDescription>
                        Propostas apresentadas e participação registrada no período.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <MetricCard
                      label="Propostas substantivas"
                      value={ranked.metrics.substantiveProposals}
                      detail="PL, PLP, PEC, PDL e PRC"
                    />
                    <MetricCard
                      label="Fiscalização"
                      value={ranked.metrics.oversightProposals}
                      detail="RIC e PFC"
                    />
                    <MetricCard
                      label="Propostas que avançaram"
                      value={ranked.metrics.advancedProposals}
                      detail="Mais de uma etapa de tramitação"
                    />
                    <MetricCard
                      label="Transformadas em norma"
                      value={ranked.metrics.convertedProposals}
                      detail="Resultado adicional, não atribuição exclusiva"
                    />
                      <MetricCard
                        label="Sessões deliberativas"
                        value={ranked.metrics.plenaryAttendances}
                        detail="Presenças publicadas pela Câmara"
                      />
                      <MetricCard
                        label="Votos nominais"
                        value={ranked.metrics.nominalVotes}
                        detail="Votos individuais registrados"
                      />
                  </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Propostas apresentadas</CardTitle>
                      <CardDescription>
                        Até 10 propostas substantivas ou de fiscalização mais recentes.
                        {index === "public-value"
                          ? " A memória de cálculo aparece quando a classificação está disponível."
                          : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {periodDetails?.proposals.length ? (
                        periodDetails.proposals.map((proposal) => (
                          <a
                            key={proposal.id}
                            href={proposal.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg border p-4 hover:bg-muted"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold">
                                {proposal.type} {proposal.number}/{proposal.year}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(proposal.date)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-pretty">
                              {proposal.summary}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {proposal.status}
                            </p>
                            {index === "public-value" && (
                              <div className="mt-3 rounded-md bg-muted p-3 text-xs">
                                {proposal.publicValue ? (
                                  <>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="secondary">
                                        {proposal.publicValue.categoryLabel}
                                      </Badge>
                                      <span className="font-semibold tabular-nums">
                                        {proposal.publicValue.points.toLocaleString(
                                          "pt-BR",
                                          { maximumFractionDigits: 2 },
                                        )}{" "}
                                        pontos
                                      </span>
                                    </div>
                                    <p className="mt-2 text-muted-foreground">
                                      Peso {proposal.publicValue.categoryWeight} ×
                                      estágio{" "}
                                      {stageLabel(proposal.publicValue.stage)} (
                                      {proposal.publicValue.stageMultiplier
                                        .toLocaleString("pt-BR")})
                                    </p>
                                    <p className="mt-1 text-muted-foreground">
                                      {proposal.publicValue.justification}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-muted-foreground">
                                    Classificação pendente de revisão. Esta proposta
                                    não recebeu zero e não entrou no cálculo.
                                  </p>
                                )}
                              </div>
                            )}
                          </a>
                        ))
                      ) : (
                        <EmptyData text="Nenhuma proposta encontrada no período." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="equipe" className="mt-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Equipe do gabinete</CardTitle>
                    <CardDescription>
                      Retrato atual publicado pela Câmara; não muda com o ano selecionado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-3xl font-semibold tabular-nums">
                      {identityDetails?.staff.length || 0}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        secretários parlamentares
                      </span>
                    </p>
                    <div className="divide-y rounded-lg border">
                      {identityDetails?.staff.length ? (
                        identityDetails.staff.map((person) => (
                          <div
                            key={`${person.name}-${person.role}`}
                            className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <p className="font-medium">{person.name}</p>
                            <div className="text-xs text-muted-foreground sm:text-right">
                              <p>{person.role}</p>
                              {person.startDate && (
                                <p>Desde {formatDate(person.startDate)}</p>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyData text="Equipe não disponível no arquivo atual." />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="gastos" className="mt-5">
                <div className="space-y-5">
                  <Card>
                  <CardHeader>
                      <CardTitle>Gastos da cota parlamentar</CardTitle>
                    <CardDescription>
                        Despesas líquidas da CEAP entre {formatDate(period.start)} e{" "}
                        {formatDate(period.end)}.
                    </CardDescription>
                  </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-3">
                    <MetricCard
                      label="Despesas líquidas"
                      value={formatCurrency(ranked.metrics.expensesTotal)}
                      detail="Total da CEAP no período"
                    />
                    <MetricCard
                      label="Documentos"
                      value={ranked.metrics.expenseDocuments}
                      detail="Registros de despesa publicados"
                    />
                    <MetricCard
                      label="Concentração"
                      value={
                        ranked.metrics.supplierConcentration === null
                          ? null
                          : `${Math.round(
                              ranked.metrics.supplierConcentration * 100,
                            )}%`
                      }
                      detail="Índice HHI por fornecedor; menor é mais distribuído"
                    />
                  </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Para onde foi a cota</CardTitle>
                      <CardDescription>
                        Categorias ordenadas pelo valor total no período.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MoneyList
                        rows={(periodDetails?.expenseCategories || []).map((item) => ({
                          label: item.name,
                          value: item.total,
                          detail: `${item.documents} documentos`,
                        }))}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Maiores despesas</CardTitle>
                      <CardDescription>
                        Links abrem o documento oficial quando publicado pela Câmara.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {periodDetails?.largestExpenses.length ? (
                        periodDetails.largestExpenses.map((expense, index) => (
                          <div
                            key={`${expense.date}-${expense.supplier}-${index}`}
                            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {expense.category}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {expense.supplier} · {formatDate(expense.date)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="font-semibold tabular-nums">
                                {formatCurrency(expense.value)}
                              </span>
                              {expense.documentUrl && (
                                <a
                                  href={expense.documentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={buttonVariants({
                                    variant: "outline",
                                    size: "sm",
                                  })}
                                >
                                  Nota <ExternalLink className="size-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyData text="Nenhuma despesa encontrada no período." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="fornecedores" className="mt-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Quem recebeu recursos da cota</CardTitle>
                    <CardDescription>
                      Dez maiores fornecedores no período selecionado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MoneyList
                      rows={(periodDetails?.suppliers || []).map((supplier) => ({
                        label: supplier.name,
                        value: supplier.total,
                        detail: `${supplier.documents} documentos${
                          supplier.taxId ? ` · ${supplier.taxId}` : ""
                        }`,
                      }))}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="emendas" className="mt-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Emendas parlamentares</CardTitle>
                    <CardDescription>
                      Até 10 maiores registros do Transferegov associados ao nome
                      do parlamentar.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-5 grid gap-4 sm:grid-cols-2">
                      <MetricCard
                        label="Valor indicado nos registros"
                        value={formatCurrency(
                          (periodDetails?.amendments || []).reduce(
                            (sum, item) => sum + item.proposedValue,
                            0,
                          ),
                        )}
                        detail={`${periodDetails?.amendments.length || 0} registros exibidos`}
                      />
                      <MetricCard
                        label="Repasse nos registros"
                        value={formatCurrency(
                          (periodDetails?.amendments || []).reduce(
                            (sum, item) => sum + item.transferredValue,
                            0,
                          ),
                        )}
                        detail="Valor informado no arquivo oficial"
                      />
                    </div>
                    {periodDetails?.amendments.length ? (
                      <div className="divide-y rounded-lg border">
                        {periodDetails.amendments.map((amendment, index) => (
                          <div
                            key={`${amendment.number}-${amendment.beneficiary}-${index}`}
                            className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"
                          >
                            <div>
                              <p className="font-medium">
                                Emenda {amendment.number} · {amendment.type}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Beneficiário: {amendment.beneficiary}
                              </p>
                            </div>
                            <div className="text-sm tabular-nums sm:text-right">
                              <p className="font-semibold">
                                {formatCurrency(amendment.transferredValue)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Indicado: {formatCurrency(amendment.proposedValue)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyData text="Nenhuma emenda individual vinculada no período." />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="patrimonio" className="mt-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Patrimônio declarado em 2022</CardTitle>
                    <CardDescription>
                      Bens informados à Justiça Eleitoral pelo próprio candidato.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MetricCard
                      label="Total declarado"
                      value={formatCurrency(ranked.assetsTotal)}
                      detail={
                        ranked.assetsCount === null
                          ? "Dados indisponíveis"
                          : `${ranked.assetsCount} bens declarados`
                      }
                    />
                    <div className="mt-5 divide-y rounded-lg border">
                      {identityDetails?.assets.length ? (
                        identityDetails.assets.map((asset, index) => (
                          <div
                            key={`${asset.type}-${index}`}
                            className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"
                          >
                            <div>
                              <p className="font-medium">{asset.type}</p>
                              <p className="mt-1 text-xs text-muted-foreground text-pretty">
                                {asset.description}
                              </p>
                            </div>
                            <p className="font-semibold tabular-nums">
                              {formatCurrency(asset.value)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <EmptyData text="Nenhum bem disponível para esta candidatura." />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="fontes" className="mt-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Rastreabilidade</CardTitle>
                    <CardDescription>
                      Confira os dados diretamente nas fontes oficiais.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SourceLink href={ranked.chamberUrl} label="Perfil na API da Câmara" />
                    <SourceLink
                      href="https://dadosabertos.camara.leg.br/"
                      label="Dados Abertos da Câmara"
                    />
                    <SourceLink
                      href="https://dadosabertos.tse.jus.br/dataset/candidatos-2022"
                      label="Candidaturas 2022 no TSE"
                    />
                    <SourceLink
                      href="https://dadosabertos.camara.leg.br/arquivos/funcionarios/csv/funcionarios.csv"
                      label="Quadro atual de funcionários da Câmara"
                    />
                    <SourceLink
                      href="https://repositorio.dados.gov.br/seges/detru/siconv_emenda.csv.zip"
                      label="Emendas parlamentares no Transferegov"
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <aside className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Composição do score</CardTitle>
                  <CardDescription>
                    {index === "public-value"
                      ? "50% contribuição, 25% eficiência, 15% participação e 10% transparência."
                      : "25% para cada dimensão."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {index === "public-value" && (
                    <DimensionScore
                      label="Contribuição pública"
                      value={profileDimension(ranked, "contribution")}
                      explanation={dimensionExplanation(
                        ranked,
                        index,
                        "contribution",
                      )}
                      index={index}
                    />
                  )}
                  {index === "public-value" && (
                    <DimensionScore
                      label="Eficiência financeira"
                      value={profileDimension(ranked, "efficiency")}
                      explanation={dimensionExplanation(
                        ranked,
                        index,
                        "efficiency",
                      )}
                      index={index}
                    />
                  )}
                  <DimensionScore
                    label="Participação"
                    value={ranked.dimensions.participation}
                    explanation={dimensionExplanation(
                      ranked,
                      index,
                      "participation",
                    )}
                    index={index}
                  />
                  {index === "current" && (
                    <DimensionScore
                      label="Produção"
                      value={profileDimension(ranked, "production")}
                      explanation={dimensionExplanation(
                        ranked,
                        index,
                        "production",
                      )}
                      index={index}
                    />
                  )}
                  {index === "current" && (
                    <DimensionScore
                      label="Uso de recursos"
                      value={profileDimension(ranked, "resources")}
                      explanation={dimensionExplanation(
                        ranked,
                        index,
                        "resources",
                      )}
                      index={index}
                    />
                  )}
                  <DimensionScore
                    label="Transparência"
                    value={ranked.dimensions.transparency}
                    explanation={dimensionExplanation(
                      ranked,
                      index,
                      "transparency",
                    )}
                    index={index}
                  />
                  {index === "public-value" && (
                    <p className="rounded-md bg-muted p-3 text-xs leading-5 text-muted-foreground">
                      {ranked.metrics.publicClassifiedProposals || 0} de{" "}
                      {ranked.metrics.publicTotalProposals || 0} proposições
                      classificadas. Metodologia revisada em{" "}
                      {formatDate(classificationMetadata.reviewedAt)}.
                    </p>
                  )}
                  <Separator />
                  <Link
                    href="/metodologia"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full",
                    )}
                  >
                    <FileCheck2 className="size-4" /> Ver metodologia
                  </Link>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <Landmark className="size-4" /> Contexto da comparação
                  </p>
                  <p className="mt-2 text-muted-foreground text-pretty">
                    {index === "public-value"
                      ? "A posição experimental é calculada entre todos os deputados elegíveis no período."
                      : context.uf || context.partido
                      ? `Comparado com ${cohort.length} deputados do grupo selecionado.`
                      : `Comparado com ${cohort.length} deputados em exercício no período.`}
                  </p>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number | null;
  detail: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value === null ? "Dados indisponíveis" : value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MoneyList({
  rows,
}: {
  rows: Array<{ label: string; value: number; detail: string }>;
}) {
  if (!rows.length) return <EmptyData text="Dados indisponíveis no período." />;
  return (
    <div className="divide-y rounded-lg border">
      {rows.map((row) => (
        <div
          key={`${row.label}-${row.detail}`}
          className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"
        >
          <div className="min-w-0">
            <p className="font-medium text-pretty">{row.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
          </div>
          <p className="font-semibold tabular-nums">{formatCurrency(row.value)}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyData({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function profileDimension(
  deputy: RankedDeputy | PublicValueRankedDeputy,
  key: "production" | "resources" | "contribution" | "efficiency",
) {
  if ("production" in deputy.dimensions) {
    if (key === "production") return deputy.dimensions.production;
    if (key === "resources") return deputy.dimensions.resources;
    return null;
  }
  if (key === "contribution") return deputy.dimensions.contribution;
  if (key === "efficiency") return deputy.dimensions.efficiency;
  return null;
}

function stageLabel(stage: string) {
  if (stage === "converted") return "transformada em norma";
  if (stage === "advanced") return "com tramitação";
  return "apresentada";
}

function ProfileRankTrend({ change }: { change?: RankChange }) {
  if (!change?.previousPeriod || change.delta === null) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">Sem comparação anual</p>
    );
  }
  if (change.delta === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Manteve a posição desde {change.previousPeriod}
      </p>
    );
  }
  const improved = change.delta > 0;
  const Icon = improved ? ArrowUp : ArrowDown;
  return (
    <p
      className={cn(
        "mt-2 inline-flex items-center gap-1 text-xs font-medium",
        improved ? "text-emerald-600" : "text-red-600",
      )}
    >
      <Icon className="size-3.5" />
      {Math.abs(change.delta)} posições desde {change.previousPeriod}
    </p>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 text-sm font-medium hover:bg-muted"
    >
      {label}
      <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
    </a>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}
