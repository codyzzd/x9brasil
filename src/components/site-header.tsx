"use client";

import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const links = [
  { href: "/", label: "Ranking" },
  { href: "/metodologia", label: "Metodologia" },
  { href: "/fontes", label: "Fontes" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-10 items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Search className="size-4" aria-hidden="true" />
          </span>
          <span>Raio-X Eleitoral</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={buttonVariants({ variant: "ghost" })}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Sheet>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            }
          />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Raio-X Eleitoral</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-2 px-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={buttonVariants({
                    variant: "ghost",
                    className: "justify-start",
                  })}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
