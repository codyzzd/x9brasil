import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="h-6 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-5 h-10 w-full max-w-xl animate-pulse rounded bg-muted" />
          <div className="mt-3 h-5 w-full max-w-3xl animate-pulse rounded bg-muted" />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
