import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileCheck2,
  Landmark,
  MapPin,
} from "lucide-react";
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
import {
  calculateRanking,
  formatCurrency,
} from "@/lib/ranking";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ uf?: string; partido?: string }>;
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
  const cohort = rankingSnapshot.deputies.filter(
    (item) =>
      (!context.uf || item.state === context.uf) &&
      (!context.partido || item.party === context.partido),
  );
  const ranked =
    calculateRanking(cohort).find((item) => item.id === deputy.id) ||
    calculateRanking(rankingSnapshot.deputies).find((item) => item.id === deputy.id);
  if (!ranked) notFound();

  const back = new URLSearchParams();
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
                </div>
              </div>
              <div className="text-center sm:min-w-36">
                <p className="text-xs text-muted-foreground">
                  {ranked.rank ? `${ranked.rank}º na coorte` : "Sem posição"}
                </p>
                <SemanticScore value={ranked.score} className="mt-2 w-full justify-center" />
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <Tabs defaultValue="atividade">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="atividade">Atividade</TabsTrigger>
                <TabsTrigger value="votacoes">Votações e presença</TabsTrigger>
                <TabsTrigger value="recursos">Recursos</TabsTrigger>
                <TabsTrigger value="campanha">Campanha e bens</TabsTrigger>
                <TabsTrigger value="fontes">Fontes</TabsTrigger>
              </TabsList>

              <TabsContent value="atividade" className="mt-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Produção legislativa</CardTitle>
                    <CardDescription>
                      Valores registrados durante o período analisado.
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
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="votacoes" className="mt-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Participação registrada</CardTitle>
                    <CardDescription>
                      Não representa uma jornada de trabalho; mede registros oficiais.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
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
                    <MetricCard
                      label="Meses em exercício"
                      value={Number(ranked.metrics.monthsInOffice.toFixed(1))}
                      detail={`Período até ${formatDate(rankingSnapshot.period.end)}`}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="recursos" className="mt-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Uso da cota parlamentar</CardTitle>
                    <CardDescription>
                      O valor é avaliado junto à atividade, não isoladamente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
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
              </TabsContent>

              <TabsContent value="campanha" className="mt-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Eleição de 2022</CardTitle>
                    <CardDescription>
                      Dados vinculados pelo nome civil e unidade federativa.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <MetricCard
                      label="Bens declarados"
                      value={formatCurrency(ranked.assetsTotal)}
                      detail={
                        ranked.assetsCount === null
                          ? "Dados indisponíveis"
                          : `${ranked.assetsCount} registros`
                      }
                    />
                    <MetricCard
                      label="Receitas de campanha"
                      value={null}
                      detail="Ainda não importadas no snapshot"
                    />
                    <MetricCard
                      label="Despesas de campanha"
                      value={null}
                      detail="Ainda não importadas no snapshot"
                    />
                    <MetricCard
                      label="Situação das contas"
                      value={null}
                      detail="Ainda não importada no snapshot"
                    />
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
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <aside className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Composição do score</CardTitle>
                  <CardDescription>25% para cada dimensão.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <DimensionScore
                    label="Participação"
                    value={ranked.dimensions.participation}
                  />
                  <DimensionScore
                    label="Produção"
                    value={ranked.dimensions.production}
                  />
                  <DimensionScore
                    label="Uso de recursos"
                    value={ranked.dimensions.resources}
                  />
                  <DimensionScore
                    label="Transparência"
                    value={ranked.dimensions.transparency}
                  />
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
                    {context.uf || context.partido
                      ? `Comparado com ${cohort.length} deputados do grupo selecionado.`
                      : `Comparado com os ${cohort.length} deputados federais atuais.`}
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
