import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DataBanner } from "@/components/data-banner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Score Brasil",
    template: "%s | Score Brasil",
  },
  description:
    "Entenda o desempenho real dos políticos com dados, votos, gastos e impacto público.",
  keywords: [
    "Score Brasil",
    "ranking políticos",
    "desempenho deputados",
    "atividade legislativa",
    "gastos parlamentares",
    "votos políticos",
    "dados públicos",
    "Câmara dos Deputados",
    "TSE",
    "transparência política",
    "valor público",
    "índice parlamentar",
  ],
  authors: [{ name: "Score Brasil" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Score Brasil",
    title: "Score Brasil",
    description:
      "Entenda o desempenho real dos políticos com dados, votos, gastos e impacto público.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Score Brasil",
    description:
      "Entenda o desempenho real dos políticos com dados, votos, gastos e impacto público.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DataBanner />
        {children}
      </body>
    </html>
  );
}
