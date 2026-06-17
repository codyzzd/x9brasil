import type { Metadata } from "next";
import { Suspense } from "react";
import { MethodologyContent } from "@/components/methodology-content";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Metodologia",
  description:
    "Como são calculados o Índice atual e o Valor Público dos deputados federais no Score Brasil.",
};

export default function MethodologyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm font-medium text-muted-foreground">
            Metodologia
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance">
            Como os dois índices são calculados
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground text-pretty">
            O ranking oferece o Índice atual, que compara atividade
            parlamentar, recursos e transparência, e o Valor Público, um
            índice experimental que dá mais peso à contribuição das
            proposições. Os dois resultados vão de 0 a 100.
          </p>

          <div className="mt-8">
            <Suspense
              fallback={
                <div className="h-96 animate-pulse rounded-lg bg-muted" />
              }
            >
              <MethodologyContent />
            </Suspense>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
