import type { Metadata } from "next";
import { ExternalLink, FileArchive, Landmark } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { rankingSnapshot } from "@/lib/data";

export const metadata: Metadata = {
  title: "Fontes",
  description: "Fontes públicas oficiais usadas pelo ranking.",
};

const sources = [
  {
    name: "Dados Abertos da Câmara",
    description:
      "Deputados em exercício, presenças, votos nominais, proposições e despesas da CEAP.",
    url: "https://dadosabertos.camara.leg.br/",
  },
  {
    name: "Portal de Dados Abertos do TSE",
    description:
      "Candidaturas de 2022 e bens declarados à Justiça Eleitoral.",
    url: "https://dadosabertos.tse.jus.br/",
  },
  {
    name: "DivulgaCandContas",
    description:
      "Fonte oficial prevista para receitas, despesas e situação das contas eleitorais.",
    url: "https://divulgacandcontas.tse.jus.br/",
  },
];

export default function SourcesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <Badge variant="secondary">
            <Landmark className="size-3.5" /> Origem dos dados
          </Badge>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance">
            Fontes oficiais e rastreáveis
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground text-pretty">
            O snapshot foi gerado em{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: rankingSnapshot.timezone,
            }).format(new Date(rankingSnapshot.generatedAt))}
            .
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {sources.map((source) => (
              <Card key={source.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{source.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="min-h-24 text-sm text-muted-foreground text-pretty">
                    {source.description}
                  </p>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 text-sm font-medium hover:underline"
                  >
                    Acessar fonte <ExternalLink className="size-4" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileArchive className="size-5" /> Conjuntos processados
              </CardTitle>
              <CardDescription>
                Cobertura histórica de{" "}
                {formatDate(rankingSnapshot.periods[0].start)} a{" "}
                {formatDate(
                  rankingSnapshot.periods.find(
                    (period) => period.id === rankingSnapshot.defaultPeriod,
                  )?.end || rankingSnapshot.periods[0].end,
                )}
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                "Eventos e presenças",
                "Votos individuais",
                "Proposições e autores",
                "Tramitações por ano",
                "Histórico de exercício parlamentar",
                "Cota parlamentar",
                "Candidaturas 2022",
                "Bens declarados 2022",
              ].map((item) => (
                <div key={item} className="rounded-md border p-3 font-medium">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}
