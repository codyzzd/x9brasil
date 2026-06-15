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
  PUBLIC_VALUE_WEIGHTS,
  publicValueClassificationMetadata,
} from "@/lib/public-value";

export const metadata: Metadata = {
  title: "Metodologia",
  description: "Fórmula, dados e limitações do ranking de deputados federais.",
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

export default function MethodologyPage() {
  const publicValueMetadata = publicValueClassificationMetadata();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm font-medium text-muted-foreground">Metodologia</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance">
            Quatro dimensões com o mesmo peso
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground text-pretty">
            O score compara deputados submetidos ao mesmo recorte de estado e
            partido. Valores absolutos são convertidos em percentis para reduzir
            distorções de escala.
          </p>

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
                <Calculator className="size-5" /> Fórmula
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
                title="Produção"
                text="PL, PLP, PEC, PDL e PRC valem 1 ponto; RIC e PFC valem 0,5; proposta com mais de uma etapa de tramitação acrescenta 0,75; transformação em norma acrescenta 2. O total é dividido pelos meses em exercício."
              />
              <Method
                title="Recursos"
                text="70% vem de 100 menos o excesso do percentil de despesa sobre o percentil médio de participação e produção. Os 30% restantes usam o inverso do índice HHI de concentração por fornecedor."
              />
              <Method
                title="Coorte"
                text="Período, estado e partido selecionados definem quem participa do cálculo. A busca por nome só reduz a lista visível e não recalcula as notas."
              />
              <Method
                title="Elegibilidade"
                text="Em cada ano, mandatos com menos de 90 dias ou sem uma das dimensões operacionais aparecem sem posição. Anos em andamento são identificados como parciais, e dados ausentes nunca são transformados em zero."
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

          <Card className="mt-10 border-blue-200 dark:border-blue-900">
            <CardHeader>
              <CardTitle>Valor Público experimental</CardTitle>
              <CardDescription>
                Índice paralelo; não substitui a metodologia principal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm leading-6">
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                score = contribuição × {PUBLIC_VALUE_WEIGHTS.contribution}
                {"\n"}      + eficiência × {PUBLIC_VALUE_WEIGHTS.efficiency}
                {"\n"}      + participação × {PUBLIC_VALUE_WEIGHTS.participation}
                {"\n"}      + transparência × {PUBLIC_VALUE_WEIGHTS.transparency}
              </pre>
              <Method
                title="Contribuição pública"
                text="Cada proposição classificada recebe peso temático multiplicado pelo estágio: 0,25 quando apresentada, 0,75 quando possui tramitação e 1 quando transformada em norma. Nesta versão, somente a autoria principal é considerada."
              />
              <Method
                title="Eficiência financeira"
                text="Razão entre pontos de contribuição e despesas da cota, convertida em percentil nacional do mesmo período. Gastar mais não reduz a nota isoladamente; reduz quando a contribuição não acompanha o gasto."
              />
              <Method
                title="Cobertura e revisão"
                text={`Classificações ambíguas ficam pendentes e não recebem zero. A taxonomia está na versão ${publicValueMetadata.methodologyVersion}, revisada em ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${publicValueMetadata.reviewedAt}T12:00:00`))}.`}
              />
              <Method
                title="Comparação"
                text="Notas e posições são calculadas nacionalmente. Estado e partido apenas filtram a visualização e não alteram o resultado experimental."
              />
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
