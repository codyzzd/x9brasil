import type { Metadata } from "next";
import { AlertTriangle, Calculator, CheckCircle2 } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SCORE_WEIGHTS } from "@/lib/ranking";
import {
  PUBLIC_VALUE_CATEGORIES,
  PUBLIC_VALUE_WEIGHTS,
  publicValueClassificationMetadata,
} from "@/lib/public-value";

export const metadata: Metadata = {
  title: "Metodologia",
  description:
    "Como são calculados o Índice atual e o Valor Público dos deputados federais.",
};

const dimensions = [
  {
    title: "Participação",
    weight: SCORE_WEIGHTS.participation,
    description:
      "Média dos percentis de presenças em sessões deliberativas e votos nominais por mês em exercício.",
  },
  {
    title: "Produção qualificada",
    weight: SCORE_WEIGHTS.production,
    description:
      "Propostas substantivas, fiscalização, avanço de tramitação e normas, ponderados e normalizados por mês.",
  },
  {
    title: "Uso responsável de recursos",
    weight: SCORE_WEIGHTS.resources,
    description:
      "Compatibilidade entre despesa e atividade, combinada com a concentração dos gastos por fornecedor.",
  },
  {
    title: "Transparência",
    weight: SCORE_WEIGHTS.transparency,
    description:
      "20 pontos por bloco disponível: candidatura, bens, receitas, despesas e situação das contas.",
  },
] as const;

const publicValueCategoryGroups = [
  {
    points: 10,
    labels: Object.values(PUBLIC_VALUE_CATEGORIES)
      .filter((category) => category.weight === 10)
      .map((category) => category.label),
  },
  {
    points: 8,
    labels: Object.values(PUBLIC_VALUE_CATEGORIES)
      .filter((category) => category.weight === 8)
      .map((category) => category.label),
  },
  {
    points: 6,
    labels: Object.values(PUBLIC_VALUE_CATEGORIES)
      .filter((category) => category.weight === 6)
      .map((category) => category.label),
  },
  {
    points: 1,
    labels: Object.values(PUBLIC_VALUE_CATEGORIES)
      .filter((category) => category.weight === 1)
      .map((category) => category.label),
  },
] as const;

export default function MethodologyPage() {
  const publicValueMetadata = publicValueClassificationMetadata();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm font-medium text-muted-foreground">Metodologia</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance">
            Como os dois índices são calculados
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground text-pretty">
            O ranking oferece o Índice atual, que compara atividade parlamentar,
            recursos e transparência, e o Valor Público, um índice experimental
            que dá mais peso à contribuição das proposições. Os dois resultados
            vão de 0 a 100.
          </p>

          <Card className="mt-10">
            <CardHeader>
              <CardTitle>Regra comum: transformação em percentis</CardTitle>
              <CardDescription>
                A maior parte das métricas não entra na fórmula como valor bruto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                Primeiro calculamos a métrica individual, como presenças por mês
                ou pontos de contribuição por mês. Depois ordenamos os valores do
                grupo comparado e convertemos cada um para uma posição de 0 a 100:
                o menor recebe 0, o maior recebe 100 e os demais ficam
                proporcionalmente entre eles.
              </p>
              <p>
                Valores iguais recebem o mesmo percentil médio. Quando há apenas
                um deputado com dado disponível, ele recebe percentil 50. Dados
                ausentes permanecem indisponíveis e nunca são convertidos em zero.
              </p>
            </CardContent>
          </Card>

          <div className="mt-12">
            <p className="text-sm font-medium text-muted-foreground">
              Índice 1
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight">
              Índice atual
            </h2>
            <p className="mt-3 leading-7 text-muted-foreground text-pretty">
              Compara deputados do período, estado e partido selecionados. Cada
              dimensão vale 25% da nota final.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {dimensions.map((dimension) => (
              <Card key={dimension.title}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    {dimension.title}
                    <span className="text-2xl tabular-nums">
                      {dimension.weight * 100}%
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-muted-foreground">
                  {dimension.description}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="size-5" /> Fórmula do Índice atual
              </CardTitle>
              <CardDescription>Resultado arredondado de 0 a 100.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                score = participação × 0,25 + produção × 0,25
                {"\n"}      + recursos × 0,25 + transparência × 0,25
              </pre>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Escala visual</CardTitle>
              <CardDescription>
                As cores funcionam como um semáforo e sempre aparecem acompanhadas
                de texto.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Band
                className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                dot="bg-red-500"
                title="Baixo"
                range="0–49"
              />
              <Band
                className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
                dot="bg-amber-500"
                title="Médio"
                range="50–64"
              />
              <Band
                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
                dot="bg-emerald-500"
                title="Bom"
                range="65–100"
              />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Detalhes dos cálculos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm leading-6">
              <Method
                title="1. Participação"
                text="Presenças em sessões deliberativas e votos nominais são divididos pelos meses em exercício. Cada taxa mensal vira um percentil dentro da coorte, e a nota de participação é a média dos dois percentis."
              />
              <Method
                title="2. Produção qualificada"
                text="PL, PLP, PEC, PDL e PRC valem 1 ponto; RIC e PFC valem 0,5; cada proposição com tramitação acrescenta 0,75; transformação em norma acrescenta 2. O total ponderado é dividido pelos meses em exercício e convertido em percentil da coorte."
              />
              <Method
                title="3. Uso responsável de recursos"
                text="A atividade é a média entre participação e produção. O alinhamento da despesa começa em 100 e perde apenas o quanto o percentil de gasto mensal ultrapassa o percentil de atividade. A concentração é medida pelo HHI, soma dos quadrados da participação de cada fornecedor no gasto; a nota de distribuição é (1 − HHI) × 100. A nota de recursos é 70% alinhamento da despesa + 30% distribuição."
              />
              <Method
                title="4. Transparência"
                text="São verificados cinco blocos oficiais: candidatura, bens, receitas eleitorais, despesas eleitorais e situação das contas. Cada bloco disponível vale 20 pontos, totalizando de 0 a 100."
              />
              <Method
                title="Coorte"
                text="Período, estado e partido selecionados definem quem participa do cálculo. A busca por nome só reduz a lista visível e não recalcula as notas."
              />
              <Method
                title="Elegibilidade e posição"
                text="Mandatos com menos de três meses ou sem participação, produção ou recursos aparecem sem nota e sem posição. Os elegíveis são ordenados pela nota final; em caso de empate, a ordem é alfabética. Anos em andamento são identificados como parciais."
              />
            </CardContent>
          </Card>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="size-4" /> O que o score permite
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                Comparar registros oficiais de atividade, produção, recursos e
                disponibilidade de dados dentro de uma mesma coorte.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4" /> O que ele não afirma
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                Não mede honestidade, qualidade política, impacto social, ideologia ou
                se o eleitor deve votar no parlamentar.
              </CardContent>
            </Card>
          </div>

          <Card className="mt-12 border-blue-200 dark:border-blue-900">
            <CardHeader>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                Índice 2
              </p>
              <CardTitle className="text-3xl">Valor Público experimental</CardTitle>
              <CardDescription>
                Calculado nacionalmente e com maior peso para contribuição
                pública. Não substitui a metodologia principal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm leading-6">
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                score = contribuição × {PUBLIC_VALUE_WEIGHTS.contribution * 100}%
                {"\n"}      + eficiência × {PUBLIC_VALUE_WEIGHTS.efficiency * 100}%
                {"\n"}      + participação × {PUBLIC_VALUE_WEIGHTS.participation * 100}%
                {"\n"}      + transparência × {PUBLIC_VALUE_WEIGHTS.transparency * 100}%
              </pre>
              <Method
                title="1. Contribuição pública — 50%"
                text="Cada proposição classificada recebe pontos do tema multiplicados pelo estágio: 25% quando apenas apresentada, 75% quando possui tramitação e 100% quando transformada em norma. Somamos os pontos, dividimos pelos meses em exercício e convertemos o resultado em percentil nacional. Nesta versão, somente a autoria principal é considerada."
              />
              <Method
                title="2. Eficiência financeira — 25%"
                text="Calculamos pontos de contribuição ÷ despesas da cota × R$ 100 mil. Essa razão, que representa quantos pontos foram obtidos por R$ 100 mil gastos, vira um percentil nacional. Gastar mais não reduz a nota isoladamente; reduz quando a contribuição não acompanha o gasto."
              />
              <Method
                title="3. Participação — 15%"
                text="É a média dos percentis nacionais de presenças em sessões e votos nominais por mês em exercício, usando o mesmo cálculo de participação do Índice atual."
              />
              <Method
                title="4. Transparência — 10%"
                text="Usa os mesmos cinco blocos oficiais do Índice atual, com 20 pontos por bloco disponível."
              />
              <Method
                title="Elegibilidade e posição"
                text="Exige pelo menos três meses de mandato e dados disponíveis de contribuição, eficiência e participação. Proposições ainda não classificadas não viram contribuição zero. Os elegíveis são ordenados pela nota final; empates seguem a ordem alfabética."
              />
              <Method
                title="Comparação"
                text="Notas e posições são calculadas nacionalmente. Estado e partido apenas filtram a visualização e não alteram o resultado experimental."
              />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Pontos temáticos do Valor Público</CardTitle>
              <CardDescription>
                O peso abaixo é multiplicado pelo estágio da proposição.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {publicValueCategoryGroups.map((group) => (
                <div
                  className="rounded-lg border p-4"
                  key={group.points}
                >
                  <p className="font-semibold tabular-nums">
                    {group.points} {group.points === 1 ? "ponto" : "pontos"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {group.labels.join(", ")}.
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Escala do Valor Público</CardTitle>
              <CardDescription>
                O índice experimental usa cinco faixas de interpretação.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Band
                className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                dot="bg-red-500"
                title="Muito baixo"
                range="0–39"
              />
              <Band
                className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400"
                dot="bg-orange-500"
                title="Baixo"
                range="40–59"
              />
              <Band
                className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
                dot="bg-amber-500"
                title="Médio"
                range="60–74"
              />
              <Band
                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
                dot="bg-emerald-500"
                title="Alto"
                range="75–89"
              />
              <Band
                className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400"
                dot="bg-blue-500"
                title="Excelente"
                range="90–100"
              />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Cobertura e revisão do Valor Público</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Classificações ambíguas ficam pendentes e não recebem zero. A
              taxonomia está na versão {publicValueMetadata.methodologyVersion},
              revisada em{" "}
              {new Intl.DateTimeFormat("pt-BR").format(
                new Date(`${publicValueMetadata.reviewedAt}T12:00:00`),
              )}
              .
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Method({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground text-pretty">{text}</p>
    </div>
  );
}

function Band({
  className,
  dot,
  title,
  range,
}: {
  className: string;
  dot: string;
  title: string;
  range: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${className}`}>
      <span className={`size-3 rounded-full ${dot}`} aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm tabular-nums">{range} pontos</p>
      </div>
    </div>
  );
}
