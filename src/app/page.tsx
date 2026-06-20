import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, Landmark, Lock, MapPinned } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

const rankCards = [
  {
    title: "Governadores",
    description:
      "Ranking estadual exige outra base de governo, orçamento e execução pública.",
    status: "Em estudo",
    available: false,
    icon: Landmark,
  },
  {
    title: "Senadores",
    description:
      "Depende de métricas próprias do Senado e integração com outra fonte legislativa.",
    status: "Em estudo",
    available: false,
    icon: Building2,
  },
  {
    title: "Deputados federais",
    description:
      "Ranking ativo com Câmara dos Deputados, TSE, votos, proposições e gastos.",
    status: "Disponível",
    available: true,
    href: "/deputados-federais",
    icon: CheckCircle2,
  },
  {
    title: "Deputados estaduais",
    description:
      "Precisa de bases por assembleia legislativa, que variam por estado.",
    status: "Em estudo",
    available: false,
    icon: MapPinned,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <section className="mb-10 space-y-6">
            <div className="max-w-4xl">
              <Badge variant="secondary">Dados públicos oficiais</Badge>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Score Brasil
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground text-pretty">
                Uma leitura comparativa do desempenho público de políticos a
                partir de dados oficiais. O ranking ativo hoje é o de deputados
                federais; os outros cargos aparecem como próximos módulos para
                manter clara a hierarquia do sistema.
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground text-pretty">
                O score é comparativo e informativo. Ele não mede ideologia,
                honestidade ou intenção de voto.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {rankCards.map((card) => (
                <RankCard key={card.title} {...card} />
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function RankCard({
  title,
  description,
  status,
  available,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  status: string;
  available: boolean;
  href?: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <Badge variant={available ? "default" : "secondary"} className="shrink-0">
          {available ? (
            status
          ) : (
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" aria-hidden />
              {status}
            </span>
          )}
        </Badge>
      </div>
      <div className="space-y-2">
        <h3 className="text-base font-semibold leading-snug">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <p className="mt-auto text-xs font-medium text-muted-foreground">
        {available ? "Abrir ranking" : "Ainda não disponível"}
      </p>
    </>
  );

  if (available && href) {
    return (
      <Link
        href={href}
        className="flex min-h-52 flex-col gap-5 rounded-lg border bg-card p-4 text-card-foreground shadow-xs transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className="flex min-h-52 flex-col gap-5 rounded-lg border bg-muted/35 p-4 text-card-foreground opacity-85"
      aria-disabled="true"
    >
      {content}
    </div>
  );
}
