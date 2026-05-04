import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelBillingSubscription,
  createBillingCheckout,
  getBillingSubscription,
  syncBillingSubscription,
} from "@/lib/api";

const billingSubscriptionQueryKey = ["billing", "subscription"] as const;

export function useBillingSubscription(enabled = true) {
  return useQuery({
    queryKey: billingSubscriptionQueryKey,
    queryFn: getBillingSubscription,
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateBillingCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBillingCheckout,
    onSuccess: (payload) => {
      queryClient.setQueryData(billingSubscriptionQueryKey, payload.subscription);
    },
  });
}

export function useCancelBillingSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelBillingSubscription,
    onSuccess: (payload) => {
      queryClient.setQueryData(billingSubscriptionQueryKey, payload);
    },
  });
}

export function useSyncBillingSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncBillingSubscription,
    onSuccess: (payload) => {
      queryClient.setQueryData(billingSubscriptionQueryKey, payload);
    },
  });
}
