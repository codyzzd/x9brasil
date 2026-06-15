"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CandidatePeriodSelect({
  period,
  periods,
  query,
}: {
  period: string;
  periods: Array<{ id: string; label: string }>;
  query: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>Período</span>
      <Select
        value={period}
        onValueChange={(value) => {
          const nextPeriod = value || periods[0]?.id || period;
          const params = new URLSearchParams(query);
          params.set("periodo", nextPeriod);
          if (!/^\d{4}$/.test(nextPeriod)) {
            params.delete("comparacao");
          }
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }}
      >
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue>
            {periods.find((item) => item.id === period)?.label || period}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {periods.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
