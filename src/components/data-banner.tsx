import { AlertTriangle } from "lucide-react";
import { getSnapshotMetadata } from "@/lib/db";

export async function DataBanner() {
  const metadata = await getSnapshotMetadata();

  const items = [
    <>
      <strong className="font-semibold">Dados públicos oficiais</strong>
    </>,
    <>
      Última atualização:{" "}
      <strong className="font-semibold">{formatDate(metadata.generatedAt)}</strong>
    </>,
    <>
      <AlertTriangle className="inline size-3.5 align-middle" /> Algoritmo em
      aprimoramento contínuo — resultados podem mudar
    </>,
  ];

  return (
    <div className="w-full overflow-hidden border-b border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex h-8 items-center">
        <div className="marquee-content flex items-center gap-12 whitespace-nowrap text-sm">
          {items.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {item}
            </span>
          ))}
          {items.map((item, i) => (
            <span key={`dup-${i}`} className="flex items-center gap-1.5">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const [date] = iso.split("T");
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}