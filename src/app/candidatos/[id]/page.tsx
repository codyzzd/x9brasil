import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  FileCheck2,
  FileStack,
  GitCompareArrows,
  GraduationCap,
  Hash,
  Landmark,
  MapPin,
  PieChart,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
  UserMinus,
  Users,
  Vote,
  WalletCards,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { CandidatePeriodSelect } from "@/components/candidate-period-select";
import { DimensionScore } from "@/components/dimension-score";
import { DimensionCard } from "@/components/dimension-card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getDeputy,
  getDeputies,
  getFullSnapshot,
  getProfileDetails,
  getPeriodOptions,
} from "@/lib/db";
import {
  dimensionExplanation,
  getDimensionCardInfo,
} from "@/lib/dimension-explanations";
import { getCandidateStyle } from "@/lib/candidate-style";
import {
  calculatePublicValueRanking,
  calculateRankChanges,
  comparisonPeriod,
  defaultRankingPeriod,
  formatCurrency,
  getRankingPeriod,
  materializePeriod,
  periodSelectOrder,
  publicValueScoreLabel,
  type PublicValueRankedDeputy,
  type RankChange,
  type RankedDeputy,
  type RankingComparison,
  type RankingIndex,
  type RawMetrics,
} from "@/lib/ranking";
import { PUBLIC_VALUE_DIMENSION_LABELS } from "@/lib/public-value";
import { getSnapshotMetadata } from "@/lib/db";
import { scoreStyle } from "@/lib/score-style";
import { cn } from "@/lib/utils";
import { labelTone } from "@/lib/label-tone";
import { ProposalsTable } from "@/components/proposals-table";
import {
  ExpenseCategoriesTable,
  LargestExpensesTable,
  SuppliersTable,
  PublicVotesTable,
  VoteDistributionBar,
  VotePositioningBar,
  AmendmentsTable,
  AssetsTable,
  CampaignDonorsTable,
  CampaignSuppliersTable,
} from "@/components/candidate-data-tables";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    uf?: string;
    partido?: string;
    periodo?: string;
    comparacao?: string;
  }>;
};

export async function generateStaticParams() {
  const deputies = await getDeputies();
  return deputies.map((deputy) => ({ id: deputy.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const deputy = await getDeputy(id);
  return {
    title: deputy?.name ?? "Deputado",
    description: deputy
      ? `Atividade legislativa e dados públicos de ${deputy.name} no Score Brasil.`
      : "Perfil de deputado federal no Score Brasil.",
  };
}

export default async function DeputyPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const deputy = await getDeputy(id);
  if (!deputy) notFound();

  const context = await searchParams;
  const snapshot = await getFullSnapshot();
  const metadata = await getSnapshotMetadata();

  const index: RankingIndex = "public-value";
  const comparison: RankingComparison =
    context.comparacao === "ano-a-ano" ? "previous-year" : "legislature-start";
  const period = getRankingPeriod(
    snapshot,
    context.periodo || defaultRankingPeriod(snapshot).id,
  );
  const periodDeputies = materializePeriod(snapshot, period.id);
  const ranked =
    calculatePublicValueRanking(periodDeputies).find(
      (item) => item.id === deputy.id,
    );
  if (!ranked) notFound();
  const profile = await getProfileDetails(deputy.id, period.id);
  const identityDetails = profile.identity;
  const periodDetails = profile.period;

  const previousPeriod = comparisonPeriod(
    snapshot,
    period.id,
    comparison,
  );
  const previousRanked = previousPeriod
    ? calculatePublicValueRanking(
        materializePeriod(snapshot, previousPeriod.id),
      )
    : null;
  const rankChange = calculateRankChanges(
    [ranked],
    previousRanked,
    previousPeriod?.label || null,
  ).get(ranked.id);
  const classificationMetadata = { methodologyVersion: "1.0.0", reviewedAt: metadata.sources[0]?.updatedAt ?? new Date().toISOString().split("T")[0] };
  const candidateStyle = getCandidateStyle(ranked.metrics);

  const back = new URLSearchParams();
  back.set("periodo", period.id);
  if (comparison === "previous-year") {
    back.set("comparacao", "ano-a-ano");
  }
  if (context.uf) back.set("uf", context.uf);
  if (context.partido) back.set("partido", context.partido);
  const periodQuery = new URLSearchParams();
  if (comparison === "previous-year" && /^\d{4}$/.test(period.id)) {
    periodQuery.set("comparacao", "ano-a-ano");
  }
  if (context.uf) periodQuery.set("uf", context.uf);
  if (context.partido) periodQuery.set("partido", context.partido);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/${back.size ? `?${back.toString()}` : ""}`}
              className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}
            >
              <ArrowLeft className="size-4" /> Voltar ao ranking
            </Link>
            <CandidatePeriodSelect
              period={period.id}
periods={periodSelectOrder((await getPeriodOptions()).map(({ id, label }) => ({
                 id,
                 label,
               })))}
              query={periodQuery.toString()}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="min-h-64">
              <CardContent className="grid h-full gap-5 py-5 sm:grid-cols-[128px_minmax(0,1fr)]">
                <div className="relative size-32 shrink-0 overflow-hidden rounded-xl bg-muted outline outline-1 -outline-offset-1 outline-black/10">
                  <Image
                    src={ranked.photoUrl}
                    alt={`Foto oficial de ${ranked.name}`}
                    fill
                    priority
                    sizes="128px"
                    className="object-cover object-top"
                  />
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="h-6 px-2.5">{ranked.party}</Badge>
                    <Badge variant="outline" className="h-6 px-2.5">
                      {ranked.state}
                    </Badge>
                    {ranked.electionStatus && (
                      <Badge variant="secondary" className="h-6 px-2.5">
                        {ranked.electionStatus}
                      </Badge>
                    )}
                    {candidateStyle && (
                      <Badge className="h-6 border-purple-200 bg-purple-50 px-2.5 text-purple-700 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-400">
                        {candidateStyle.label}
                      </Badge>
                    )}
                  </div>
                  <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                    {ranked.name}
                  </h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">{ranked.civilName}</p>
                  {ranked.labels.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {ranked.labels.map((label) => (
                        <span
                          key={label}
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            labelStyle(label),
                          )}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-6 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    {identityDetails?.birthPlace && (
                      <ProfileFact
                        icon={MapPin}
                        label="Base eleitoral"
                        value={identityDetails.birthPlace}
                      />
                    )}
                    {identityDetails?.education && (
                      <ProfileFact
                        icon={GraduationCap}
                        label="Escolaridade"
                        value={identityDetails.education}
                      />
                    )}
                    {identityDetails?.office && (
                      <ProfileFact
                        icon={BriefcaseBusiness}
                        label="Gabinete"
                        value={identityDetails.office}
                      />
                    )}
                    <ProfileFact
                      icon={CalendarDays}
                      label="Mandato atual"
                      value={`Desde ${formatDate(ranked.officeStart)}`}
                    />
                    {ranked.electionNumber && (
                      <ProfileFact
                        icon={Hash}
                        label="Número eleitoral"
                        value={ranked.electionNumber}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 py-5">
                {(() => {
                  const style = scoreStyle(ranked.score, index);
                  return (
                    <div className={cn("rounded-xl border p-4", style.soft, style.border)}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            {ranked.rank
                              ? `${ranked.rank}º no Brasil`
                              : "Sem posição"}
                          </p>
                          <ProfileRankTrend change={rankChange} />
                        </div>
                        <div className="text-right">
                          <span className={cn("block text-5xl font-bold leading-none tabular-nums", style.text)}>
                            {ranked.score ?? "—"}
                          </span>
                          <span className={cn("mt-1 block text-sm font-semibold", style.text)}>
                            {publicValueScoreLabel(ranked.score)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-3">
                  <DimensionScore
                    label="Participação"
                    value={ranked.dimensions.participation}
                    explanation={dimensionExplanation(ranked, index, "participation")}
                    index={index}
                  />
                  <DimensionScore
                    label={PUBLIC_VALUE_DIMENSION_LABELS.contribution}
                    value={profileDimension(ranked, "contribution")}
                    explanation={dimensionExplanation(ranked, index, "contribution")}
                    index={index}
                  />
                  <DimensionScore
                    label={PUBLIC_VALUE_DIMENSION_LABELS.publicVotes}
                    value={profileDimension(ranked, "publicVotes")}
                    explanation={dimensionExplanation(ranked, index, "publicVotes")}
                    index={index}
                  />
                  <DimensionScore
                    label={PUBLIC_VALUE_DIMENSION_LABELS.efficiency}
                    value={profileDimension(ranked, "efficiency")}
                    explanation={dimensionExplanation(ranked, index, "efficiency")}
                    index={index}
                  />
                  <DimensionScore
                    label={PUBLIC_VALUE_DIMENSION_LABELS.campaignFinance}
                    value={ranked.dimensions.campaignFinance}
                    explanation={dimensionExplanation(ranked, index, "campaignFinance")}
                    index={index}
                  />
                </div>

                <p className="rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
                    {ranked.metrics.publicClassifiedProposals || 0} de{" "}
                    {ranked.metrics.publicTotalProposals || 0} proposições
                    classificadas. Revisado em{" "}
                    {formatDate(classificationMetadata.reviewedAt)}.
                  </p>

                <div className="flex gap-2">
                  <Link
                    href={`/comparar?a=${encodeURIComponent(ranked.slug)}&periodo=${encodeURIComponent(period.id)}`}
                    className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
                  >
                    <GitCompareArrows className="size-3.5" /> Comparar
                  </Link>
                  <Link
                    href="/metodologia"
                    className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                    aria-label="Ver metodologia"
                  >
                    <FileCheck2 className="size-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <Tabs defaultValue="participacao">
              <TabsList className="w-full max-w-full justify-start overflow-x-auto">
                <TabsTrigger value="participacao">Participação</TabsTrigger>
                <TabsTrigger value="contribuicao">
                  {PUBLIC_VALUE_DIMENSION_LABELS.contribution}
                </TabsTrigger>
                <TabsTrigger value="votos-publicos">
                  {PUBLIC_VALUE_DIMENSION_LABELS.publicVotes}
                </TabsTrigger>
                <TabsTrigger value="eficiencia">
                  {PUBLIC_VALUE_DIMENSION_LABELS.efficiency}
                </TabsTrigger>
                <TabsTrigger value="financas-de-campanha">
                  {PUBLIC_VALUE_DIMENSION_LABELS.campaignFinance}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contribuicao" className="mt-5">
                <div className="space-y-5">
                  <DimensionCard
                    label={PUBLIC_VALUE_DIMENSION_LABELS.contribution}
                    value={ranked.dimensions.contribution}
                    explanation={dimensionExplanation(ranked, index, "contribution")}
                    cardInfo={getDimensionCardInfo(ranked.metrics, ranked.dimensions.contribution, "contribution")}
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle>Produção legislativa</CardTitle>
                      <CardDescription>
                        Distribuição dos papéis do parlamentar nas proposições em que teve participação registrada no período.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ParticipationBar metrics={ranked.metrics} />
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <MetricCard
                          icon={TrendingUp}
                          tone="emerald"
                          label="Propostas que avançaram"
                          value={ranked.metrics.advancedProposals}
                          detail="Mais de uma etapa de tramitação"
                        />
                        <MetricCard
                          icon={FileCheck2}
                          tone="sky"
                          label="Transformadas em norma"
                          value={ranked.metrics.convertedProposals}
                          detail="Resultado adicional, não atribuição exclusiva"
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Proposições registradas</CardTitle>
                      <CardDescription>
                        Proposições em que o parlamentar teve participação registrada, incluindo autorias, coautorias e requisições. Use a busca para filtrar por ementa, tipo, número ou ano.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {periodDetails?.proposals.length ? (
                        <ProposalsTable proposals={periodDetails.proposals} />
                      ) : (
                        <EmptyData text="Nenhuma proposta encontrada no período." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="votos-publicos" className="mt-5">
                <div className="space-y-5">
                  <DimensionCard
                    label={PUBLIC_VALUE_DIMENSION_LABELS.publicVotes}
                    value={ranked.dimensions.publicVotes}
                    explanation={dimensionExplanation(ranked, index, "publicVotes")}
                    cardInfo={getDimensionCardInfo(ranked.metrics, ranked.dimensions.publicVotes, "publicVotes")}
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle>Votos analisados</CardTitle>
                      <CardDescription>
                        Bônus e penalidades ligados a votações nominais específicas, com regra conservadora e fonte oficial.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {periodDetails?.publicVotes?.length ? (
                        <VotePositioningBar data={periodDetails.publicVotes} />
                      ) : null}
                      <MetricCard
                        icon={CheckCircle2}
                        tone="emerald"
                        label="Pontos positivos"
                        value={formatDecimal(ranked.metrics.publicVotePositivePoints)}
                        detail="Votos alinhados a votações classificadas como interesse público"
                      />
                      <MetricCard
                        icon={XCircle}
                        tone="red"
                        label="Penalidades por voto"
                        value={formatDecimal(ranked.metrics.publicVoteNegativePenalties)}
                        detail="Votos contrários ao interesse público em votações classificadas"
                      />
                      <MetricCard
                        icon={UserMinus}
                        tone="slate"
                        label="Penalidades por ausência"
                        value={formatDecimal(ranked.metrics.publicVoteAbsencePenalties)}
                        detail="Aplicadas apenas em votações de relevância alta ou crítica"
                      />
                      <MetricCard
                        icon={ShieldCheck}
                        tone="sky"
                        label="Confiança média"
                        value={
                          ranked.metrics.publicVoteAverageConfidence === null ||
                          ranked.metrics.publicVoteAverageConfidence === undefined
                            ? null
                            : `${formatDecimal(ranked.metrics.publicVoteAverageConfidence * 100)}%`
                        }
                        detail={`${ranked.metrics.publicVotesAnalyzed ?? 0} registros auditáveis no período`}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Votos registrados</CardTitle>
                      <CardDescription>
                        Todas as votações nominais capturadas no período. Apenas as analisadas pela metodologia impactam o score.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {periodDetails?.publicVotes?.length ? (
                        <>
                          <VoteDistributionBar data={periodDetails.publicVotes} />
                          <div className="mt-5">
                            <PublicVotesTable data={periodDetails.publicVotes} />
                          </div>
                        </>
                      ) : (
                        <EmptyData text="Nenhuma votação nominal encontrada no período." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="eficiencia" className="mt-5">
                <div className="space-y-5">
                  <DimensionCard
                    label={PUBLIC_VALUE_DIMENSION_LABELS.efficiency}
                    value={ranked.dimensions.efficiency}
                    explanation={dimensionExplanation(ranked, index, "efficiency")}
                    cardInfo={getDimensionCardInfo(ranked.metrics, ranked.dimensions.efficiency, "efficiency")}
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle>Gastos da cota parlamentar</CardTitle>
                      <CardDescription>
                        Despesas líquidas da CEAP entre {formatDate(period.start)} e {formatDate(period.end)}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-3">
                      <MetricCard
                        icon={ReceiptText}
                        tone="emerald"
                        label="Despesas líquidas"
                        value={formatCurrency(ranked.metrics.expensesTotal)}
                        detail="Total da CEAP no período"
                      />
                      <MetricCard
                        icon={FileStack}
                        tone="sky"
                        label="Documentos"
                        value={ranked.metrics.expenseDocuments}
                        detail="Registros de despesa publicados"
                      />
                      <MetricCard
                        icon={PieChart}
                        tone="amber"
                        label="Concentração"
                        value={
                          ranked.metrics.supplierConcentration === null
                            ? null
                            : `${Math.round(ranked.metrics.supplierConcentration * 100)}%`
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
                      {periodDetails?.expenseCategories.length ? (
                        <ExpenseCategoriesTable data={periodDetails.expenseCategories} />
                      ) : (
                        <EmptyData text="Nenhuma categoria encontrada." />
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Maiores despesas</CardTitle>
                      <CardDescription>
                        Links abrem o documento oficial quando publicado pela Câmara.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {periodDetails?.largestExpenses.length ? (
                        <LargestExpensesTable data={periodDetails.largestExpenses} />
                      ) : (
                        <EmptyData text="Nenhuma despesa encontrada no período." />
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Quem recebeu recursos da cota</CardTitle>
                      <CardDescription>
                        Fornecedores no período selecionado.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {periodDetails?.suppliers.length ? (
                        <SuppliersTable data={periodDetails.suppliers} />
                      ) : (
                        <EmptyData text="Nenhum fornecedor encontrado." />
                      )}
                    </CardContent>
                  </Card>
                  <NonScoredInfoDisclosure>
                    <Card>
                      <CardHeader>
                        <CardTitle>Emendas parlamentares</CardTitle>
                        <CardDescription>
                          Até 10 maiores registros do Transferegov associados ao nome do parlamentar.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-5 grid gap-4 sm:grid-cols-2">
                          <MetricCard
                            label="Valor indicado nos registros"
                            value={formatCurrency(
                              (periodDetails?.amendments || []).reduce(
                                (sum, item) => sum + item.proposedValue, 0,
                              ),
                            )}
                            detail={`${periodDetails?.amendments.length || 0} registros exibidos`}
                          />
                          <MetricCard
                            label="Repasse nos registros"
                            value={formatCurrency(
                              (periodDetails?.amendments || []).reduce(
                                (sum, item) => sum + item.transferredValue, 0,
                              ),
                            )}
                            detail="Valor informado no arquivo oficial"
                          />
                        </div>
                        {periodDetails?.amendments.length ? (
                          <AmendmentsTable data={periodDetails.amendments} />
                        ) : (
                          <EmptyData text="Nenhuma emenda individual vinculada no período." />
                        )}
                      </CardContent>
                    </Card>
                  </NonScoredInfoDisclosure>
                </div>
              </TabsContent>

              <TabsContent value="participacao" className="mt-5">
                <div className="space-y-5">
                  <DimensionCard
                    label="Participação"
                    value={ranked.dimensions.participation}
                    explanation={dimensionExplanation(ranked, index, "participation")}
                    cardInfo={getDimensionCardInfo(ranked.metrics, ranked.dimensions.participation, "participation")}
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle>Atuação em plenário</CardTitle>
                      <CardDescription>
                        Presenças e votos nominais registrados pela Câmara no período.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <MetricCard
                          icon={CalendarCheck2}
                          tone="emerald"
                          label="Sessões deliberativas"
                          {...participationMetricCard(
                            ranked.metrics.plenaryAttendances,
                            ranked.metrics.plenarySessionsTotal,
                            "de presença",
                            "falta",
                          )}
                        />
                        <MetricCard
                          icon={Vote}
                          tone="sky"
                          label="Votos nominais"
                          {...participationMetricCard(
                            ranked.metrics.nominalVotes,
                            ranked.metrics.nominalVotesTotal,
                            "registrados",
                            "ausência",
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <NonScoredInfoDisclosure>
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
                  </NonScoredInfoDisclosure>
                </div>
              </TabsContent>

              <TabsContent value="financas-de-campanha" className="mt-5">
                <div className="space-y-5">
                  <DimensionCard
                    label={PUBLIC_VALUE_DIMENSION_LABELS.campaignFinance}
                    value={ranked.dimensions.campaignFinance}
                    explanation={dimensionExplanation(ranked, index, "campaignFinance")}
                    cardInfo={getDimensionCardInfo(ranked.metrics, ranked.dimensions.campaignFinance, "campaignFinance")}
                  />

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <MetricCard
                      icon={CircleDollarSign}
                      tone="emerald"
                      label="Custo por voto"
                      value={
                        ranked.metrics.totalCampaignExpenses !== null && ranked.metrics.totalVotes !== null && ranked.metrics.totalVotes > 0
                          ? formatCurrency(ranked.metrics.totalCampaignExpenses / ranked.metrics.totalVotes)
                          : null
                      }
                      detail={
                        ranked.metrics.totalCampaignExpenses !== null && ranked.metrics.totalVotes !== null && ranked.metrics.totalVotes > 0
                          ? `${formatCurrency(ranked.metrics.totalCampaignExpenses)} gastos / ${formatDecimal(ranked.metrics.totalVotes)} votos`
                          : "Dados indisponíveis"
                      }
                    />
                    <MetricCard
                      icon={Landmark}
                      tone="amber"
                      label="Dependência de dinheiro público"
                      value={
                        ranked.metrics.totalPublicReceipts !== null && ranked.metrics.totalCampaignReceipts !== null && ranked.metrics.totalCampaignReceipts > 0
                          ? formatDecimal((ranked.metrics.totalPublicReceipts / ranked.metrics.totalCampaignReceipts) * 100) + "%"
                          : null
                      }
                      detail={
                        ranked.metrics.totalPublicReceipts !== null && ranked.metrics.totalCampaignReceipts !== null
                          ? `${formatCurrency(ranked.metrics.totalPublicReceipts)} de ${formatCurrency(ranked.metrics.totalCampaignReceipts)}`
                          : "Dados indisponíveis"
                      }
                    />
                    <MetricCard
                      icon={Users}
                      tone="violet"
                      label="Concentração de receitas"
                      value={
                        ranked.metrics.topDonors?.length > 0
                          ? formatDecimal((ranked.metrics.topDonors.slice(0, 3).reduce((s: number, d: { value: number }) => s + d.value, 0) / ranked.metrics.topDonors.reduce((s: number, d: { value: number }) => s + d.value, 0)) * 100) + "%"
                          : null
                      }
                      detail={
                        ranked.metrics.topDonors?.length > 0
                          ? `3 maiores doadores entre ${ranked.metrics.topDonors.length} declarados`
                          : "Dados indisponíveis"
                      }
                    />
                    <MetricCard
                      icon={BarChart3}
                      tone="red"
                      label="Concentração de despesas"
                      value={
                        ranked.metrics.topSuppliers?.length > 0
                          ? formatDecimal((ranked.metrics.topSuppliers.slice(0, 3).reduce((s: number, d: { value: number }) => s + d.value, 0) / ranked.metrics.topSuppliers.reduce((s: number, d: { value: number }) => s + d.value, 0)) * 100) + "%"
                          : null
                      }
                      detail={
                        ranked.metrics.topSuppliers?.length > 0
                          ? `3 maiores fornecedores entre ${ranked.metrics.topSuppliers.length} declarados`
                          : "Dados indisponíveis"
                      }
                    />
                    <MetricCard
                      icon={WalletCards}
                      tone="sky"
                      label="Receita total"
                      value={formatCurrency(ranked.metrics.totalCampaignReceipts)}
                      detail={ranked.metrics.totalCampaignReceipts !== null ? "Receitas declaradas na campanha" : "Dados indisponíveis"}
                    />
                    <MetricCard
                      icon={BadgeDollarSign}
                      tone="slate"
                      label="Despesa total"
                      value={formatCurrency(ranked.metrics.totalCampaignExpenses)}
                      detail={ranked.metrics.totalCampaignExpenses !== null ? "Despesas declaradas na campanha" : "Dados indisponíveis"}
                    />
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Cobertura de dados</CardTitle>
                      <CardDescription>
                        Fontes de dados disponíveis para este candidato. Dados ausentes não penalizam diretamente o score, mas reduzem a confiança da análise.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TransparencyBlocks metrics={ranked.metrics} />
                    </CardContent>
                  </Card>

                  {ranked.metrics.topDonors?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Principais doadores</CardTitle>
                        <CardDescription>
                          Maiores fontes de receita declaradas na campanha eleitoral.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <CampaignDonorsTable data={ranked.metrics.topDonors} />
                      </CardContent>
                    </Card>
                  )}

                  {ranked.metrics.topSuppliers?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Principais fornecedores</CardTitle>
                        <CardDescription>
                          Maiores destinos de despesa declarados na campanha eleitoral.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <CampaignSuppliersTable data={ranked.metrics.topSuppliers} />
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle>Patrimônio declarado em 2022</CardTitle>
                      <CardDescription>
                        Bens informados à Justiça Eleitoral pelo próprio candidato. Usado como indicador de consistência patrimonial, sem penalizar o candidato por ter muito ou pouco patrimônio.
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
                      {identityDetails?.assets.length ? (
                        <div className="mt-5">
                          <AssetsTable data={identityDetails.assets} />
                        </div>
                      ) : (
                        <div className="mt-5">
                          <EmptyData text="Nenhum bem disponível para esta candidatura." />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <NonScoredInfoDisclosure>
                    <Card>
                      <CardHeader>
                        <CardTitle>Rastreabilidade</CardTitle>
                        <CardDescription>
                          Confira os dados diretamente nas fontes oficiais.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <SourceLink href={ranked.chamberUrl} label="Perfil na API da Câmara" />
                        <SourceLink href="https://dadosabertos.camara.leg.br/" label="Dados Abertos da Câmara" />
                        <SourceLink href="https://dadosabertos.tse.jus.br/dataset/candidatos-2022" label="Candidaturas 2022 no TSE" />
                        <SourceLink href="https://dadosabertos.camara.leg.br/arquivos/funcionarios/csv/funcionarios.csv" label="Quadro atual de funcionários da Câmara" />
                        <SourceLink href="https://repositorio.dados.gov.br/seges/detru/siconv_emenda.csv.zip" label="Emendas parlamentares no Transferegov" />
                      </CardContent>
                    </Card>
                  </NonScoredInfoDisclosure>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ProfileFact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block text-[0.68rem] font-medium uppercase text-muted-foreground">
          {label}
        </span>
        <span className="block truncate text-sm font-medium text-foreground">
          {value}
        </span>
      </span>
    </div>
  );
}

function NonScoredInfoDisclosure({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted/70 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">
            Informações não contabilizadas no score
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            Dados oficiais exibidos para contexto e conferência, sem peso direto na nota desta aba.
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-5">
        {children}
      </div>
    </details>
  );
}

function participationMetricCard(
  value: number | null,
  total: number | null | undefined,
  rateLabel: string,
  missingSingular: string,
) {
  if (value === null) {
    return {
      value: null,
      detail: "Dados indisponíveis",
    };
  }

  if (total === null || total === undefined) {
    return {
      value,
      detail: "total ainda não publicado no snapshot",
    };
  }

  if (total <= 0) {
    return {
      value,
      detail: "Total oficial zerado no período",
    };
  }

  const safeValue = Math.min(value, total);
  const missing = Math.max(total - value, 0);
  const missingLabel = missing === 1 ? missingSingular : `${missingSingular}s`;

  return {
    value: `${formatInteger(value)} de ${formatInteger(total)}`,
    detail: `${formatPercent(safeValue / total)} ${rateLabel} · ${formatInteger(missing)} ${missingLabel}`,
  };
}

function MetricCard({
  icon: Icon,
  tone = "slate",
  label,
  value,
  detail,
}: {
  icon?: LucideIcon;
  tone?: "emerald" | "red" | "slate" | "sky" | "amber" | "violet";
  label: string;
  value: string | number | null;
  detail: string;
}) {
  const toneClass = metricToneClass(tone);

  return (
    <div className={cn("rounded-lg border p-4", toneClass.card)}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md",
              toneClass.iconWrap,
            )}
            aria-hidden="true"
          >
            <Icon className={cn("size-4", toneClass.icon)} />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold leading-tight tabular-nums text-pretty">
        {value === null ? "Dados indisponíveis" : value}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground text-pretty">{detail}</p>
    </div>
  );
}

function metricToneClass(tone: "emerald" | "red" | "slate" | "sky" | "amber" | "violet") {
  if (tone === "emerald") {
    return {
      card: "border-emerald-200/80 bg-emerald-50/35 dark:border-emerald-900/70 dark:bg-emerald-950/15",
      iconWrap: "bg-emerald-100 dark:bg-emerald-950/50",
      icon: "text-emerald-700 dark:text-emerald-400",
    };
  }
  if (tone === "red") {
    return {
      card: "border-red-200/80 bg-red-50/35 dark:border-red-900/70 dark:bg-red-950/15",
      iconWrap: "bg-red-100 dark:bg-red-950/50",
      icon: "text-red-700 dark:text-red-400",
    };
  }
  if (tone === "sky") {
    return {
      card: "border-sky-200/80 bg-sky-50/35 dark:border-sky-900/70 dark:bg-sky-950/15",
      iconWrap: "bg-sky-100 dark:bg-sky-950/50",
      icon: "text-sky-700 dark:text-sky-400",
    };
  }
  if (tone === "amber") {
    return {
      card: "border-amber-200/80 bg-amber-50/35 dark:border-amber-900/70 dark:bg-amber-950/15",
      iconWrap: "bg-amber-100 dark:bg-amber-950/50",
      icon: "text-amber-700 dark:text-amber-400",
    };
  }
  if (tone === "violet") {
    return {
      card: "border-violet-200/80 bg-violet-50/35 dark:border-violet-900/70 dark:bg-violet-950/15",
      iconWrap: "bg-violet-100 dark:bg-violet-950/50",
      icon: "text-violet-700 dark:text-violet-400",
    };
  }
  return {
    card: "border-slate-200/80 bg-slate-50/35 dark:border-slate-800 dark:bg-slate-950/20",
    iconWrap: "bg-slate-200 dark:bg-slate-900",
    icon: "text-slate-800 dark:text-slate-300",
  };
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(value);
}

const ROLE_SEGMENTS: {
  key: keyof RawMetrics;
  label: string;
  barClass: string;
  dotClass: string;
}[] = [
  {
    key: "authorProposals",
    label: "Autoria",
    barClass: "bg-emerald-500 dark:bg-emerald-400",
    dotClass: "bg-emerald-500 dark:bg-emerald-400",
  },
  {
    key: "coauthorProposals",
    label: "Coautoria",
    barClass: "bg-sky-500 dark:bg-sky-400",
    dotClass: "bg-sky-500 dark:bg-sky-400",
  },
  {
    key: "requesterProposals",
    label: "Requisição",
    barClass: "bg-violet-500 dark:bg-violet-400",
    dotClass: "bg-violet-500 dark:bg-violet-400",
  },
  {
    key: "fiscalizationProposals",
    label: "Fiscalização",
    barClass: "bg-amber-500 dark:bg-amber-400",
    dotClass: "bg-amber-500 dark:bg-amber-400",
  },
];

function ParticipationBar({ metrics }: { metrics: RawMetrics }) {
  const segments = ROLE_SEGMENTS.map((s) => ({
    ...s,
    count: (metrics[s.key] as number) || 0,
  }));
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma proposição com participação registrada no período.
      </p>
    );
  }

  return (
    <div className="space-y-4">
        <div className="flex h-2 w-full overflow-hidden rounded-full">
        {segments.map((s) => {
          const pct = (s.count / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={s.key}
              className={cn(s.barClass, "transition-all duration-500")}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${s.count} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", s.dotClass)} />
            <span className="tabular-nums font-medium">{s.count}</span>
            <span className="text-muted-foreground">{s.label}</span>
          </span>
        ))}
      </div>
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

function TransparencyBlocks({ metrics }: { metrics: RawMetrics }) {
  const blocks = [
    ["Candidatura (2022)", metrics.campaignCandidacyAvailable],
    ["Bens declarados", metrics.assetsAvailable],
    ["Receitas eleitorais", metrics.totalCampaignReceipts !== null],
    ["Despesas eleitorais", metrics.totalCampaignExpenses !== null],
    ["Receitas públicas", metrics.totalPublicReceipts !== null],
  ] as const;
  const availableCount = blocks.filter(([, available]) => available).length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {availableCount} de {blocks.length} fontes financeiras encontradas
      </p>
      <div className="flex flex-wrap gap-3">
        {blocks.map(([label, available]) => (
          <div
            key={label}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              available
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
            )}
          >
            <span className={cn("text-base", available ? "" : "opacity-50")}>
              {available ? "✓" : "✗"}
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Dados ausentes não penalizam diretamente o score do candidato, mas podem reduzir a confiança da análise.
      </p>
    </div>
  );
}

function profileDimension(
  deputy: RankedDeputy | PublicValueRankedDeputy,
  key: "production" | "resources" | "contribution" | "publicVotes" | "efficiency",
) {
  if ("production" in deputy.dimensions) {
    if (key === "production") return deputy.dimensions.production;
    if (key === "resources") return deputy.dimensions.resources;
    return null;
  }
  if (key === "contribution") return deputy.dimensions.contribution;
  if (key === "publicVotes") return deputy.dimensions.publicVotes;
  if (key === "efficiency") return deputy.dimensions.efficiency;
  return null;
}

function formatDecimal(value: number | null | undefined) {
  return value === null || value === undefined
    ? "Dados indisponíveis"
    : new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 2,
      }).format(value);
}

function labelStyle(label: string) {
  const tone = labelTone(label);
  if (tone === "positive") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400";
  }
  if (tone === "negative") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400";
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
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
