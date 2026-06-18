import type { Metadata } from "next";
import { Suspense } from "react";
import { MethodologyContent } from "@/components/methodology-content";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Metodologia",
  description:
    "Como o Score Brasil calcula o Valor Público dos deputados federais.",
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
          <h1 className="mt-2 text-4xl font-bold text-balance">
            Como o Valor Público é calculado
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground text-pretty">
            Uma leitura auditável do trabalho parlamentar: o que foi proposto,
            como o deputado votou, quanto recurso usou e qual parte da base já
            foi analisada. A nota vai de 0 a 100.
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
