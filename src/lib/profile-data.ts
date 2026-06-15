import "server-only";

import profileDetailsJson from "@/data/profile-details.json";
import type {
  ProfileDetailsSnapshot,
  ProfilePeriodDetails,
} from "@/lib/ranking";

const profileDetails =
  profileDetailsJson as unknown as ProfileDetailsSnapshot;

export function getProfileDetails(deputyId: number, periodId: string) {
  const identity =
    profileDetails.deputies.find((deputy) => deputy.id === deputyId) || null;
  if (periodId !== "legislature") {
    return {
      identity,
      period:
        profileDetails.periods
          .find((period) => period.id === periodId)
          ?.deputies.find((deputy) => deputy.id === deputyId) || null,
    };
  }

  const periods = profileDetails.periods.flatMap((period) => {
    const deputy = period.deputies.find((item) => item.id === deputyId);
    return deputy ? [deputy] : [];
  });
  return {
    identity,
    period: periods.length ? mergePeriods(deputyId, periods) : null,
  };
}

function mergePeriods(
  deputyId: number,
  periods: ProfilePeriodDetails[],
): ProfilePeriodDetails {
  const categories = new Map<string, { total: number; documents: number }>();
  const suppliers = new Map<
    string,
    { name: string; taxId: string | null; total: number; documents: number }
  >();

  for (const period of periods) {
    for (const category of period.expenseCategories) {
      const current = categories.get(category.name) || {
        total: 0,
        documents: 0,
      };
      current.total += category.total;
      current.documents += category.documents;
      categories.set(category.name, current);
    }
    for (const supplier of period.suppliers) {
      const key = supplier.taxId || supplier.name;
      const current = suppliers.get(key) || {
        name: supplier.name,
        taxId: supplier.taxId,
        total: 0,
        documents: 0,
      };
      current.total += supplier.total;
      current.documents += supplier.documents;
      suppliers.set(key, current);
    }
  }

  return {
    id: deputyId,
    expenseCategories: [...categories.entries()]
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    suppliers: [...suppliers.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    largestExpenses: periods
      .flatMap((period) => period.largestExpenses)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    proposals: Array.from(
      new Map(
        periods
          .flatMap((period) => period.proposals)
          .map((proposal) => [proposal.id, proposal]),
      ).values(),
    )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10),
    amendments: periods
      .flatMap((period) => period.amendments)
      .sort(
        (a, b) =>
          b.transferredValue +
          b.proposedValue -
          (a.transferredValue + a.proposedValue),
      )
      .slice(0, 10),
  };
}
