import Link from "next/link";
import { ExternalLink } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p>Ranking informativo com dados oficiais. Não representa a Justiça Eleitoral.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link className="hover:text-foreground" href="/metodologia">
            Como calculamos
          </Link>
          <a
            className="inline-flex items-center gap-1 hover:text-foreground"
            href="https://dadosabertos.tse.jus.br/"
            target="_blank"
            rel="noreferrer"
          >
            Dados Abertos TSE <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
