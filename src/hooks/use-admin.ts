import { useQuery } from "@tanstack/react-query";

import {
  getAdminActivity,
  getAdminFinancialMetrics,
  getAdminOverview,
  getAdminSubscriptionMetrics,
  getAdminUsers,
} from "@/lib/api";

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => getAdminOverview(),
    staleTime: 30_000,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => getAdminUsers(),
    staleTime: 30_000,
  });
}

export function useAdminFinancialMetrics() {
  return useQuery({
    queryKey: ["admin", "financial-metrics"],
    queryFn: () => getAdminFinancialMetrics(),
    staleTime: 30_000,
  });
}

export function useAdminSubscriptionMetrics() {
  return useQuery({
    queryKey: ["admin", "subscription-metrics"],
    queryFn: () => getAdminSubscriptionMetrics(),
    staleTime: 30_000,
  });
}

export function useAdminActivity() {
  return useQuery({
    queryKey: ["admin", "activity"],
    queryFn: () => getAdminActivity(20),
    staleTime: 30_000,
  });
}
