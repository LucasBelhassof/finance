import { useQuery } from "@tanstack/react-query";

import { getDashboard } from "@/lib/api";
import type { DashboardFilters } from "@/types/api";

export const dashboardQueryKey = ["dashboard"] as const;

function buildDashboardQueryKey(filters: DashboardFilters = {}) {
  return [
    ...dashboardQueryKey,
    filters.startDate ?? "start:any",
    filters.endDate ?? "end:any",
  ] as const;
}

export function useDashboard(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: buildDashboardQueryKey(filters),
    queryFn: () => getDashboard(filters),
    staleTime: 30_000,
  });
}
