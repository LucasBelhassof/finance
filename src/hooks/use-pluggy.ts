import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deletePluggyConnection,
  getPluggyStatus,
  postPluggyConnect,
  postPluggyConnectToken,
  postPluggySync,
} from "@/lib/api";
import { banksQueryKey } from "@/hooks/use-banks";
import type { PluggyConnectionStatus, PluggySyncResult } from "@/types/api";

export const pluggyStatusQueryKey = ["pluggy", "status"] as const;

export function usePluggyStatus() {
  return useQuery<PluggyConnectionStatus>({
    queryKey: pluggyStatusQueryKey,
    queryFn: getPluggyStatus,
    staleTime: 30_000,
    retry: false,
  });
}

export function usePluggyConnectToken() {
  return useMutation<string>({
    mutationFn: postPluggyConnectToken,
  });
}

export function usePluggyConnect() {
  const queryClient = useQueryClient();

  return useMutation<PluggySyncResult, Error, string>({
    mutationFn: (itemId: string) => postPluggyConnect(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pluggyStatusQueryKey });
      queryClient.invalidateQueries({ queryKey: banksQueryKey });
    },
  });
}

export function usePluggySync() {
  const queryClient = useQueryClient();

  return useMutation<PluggySyncResult>({
    mutationFn: postPluggySync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pluggyStatusQueryKey });
      queryClient.invalidateQueries({ queryKey: banksQueryKey });
    },
  });
}

export function usePluggyDisconnect() {
  const queryClient = useQueryClient();

  return useMutation<void>({
    mutationFn: deletePluggyConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pluggyStatusQueryKey });
      queryClient.invalidateQueries({ queryKey: banksQueryKey });
    },
  });
}

const PLUGGY_CONNECT_SCRIPT_ID = "pluggy-connect-sdk";
const PLUGGY_CONNECT_CDN = "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js";

export function usePluggyWidget() {
  useEffect(() => {
    if (document.getElementById(PLUGGY_CONNECT_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = PLUGGY_CONNECT_SCRIPT_ID;
    script.src = PLUGGY_CONNECT_CDN;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const openWidget = useCallback(
    (
      connectToken: string,
      onSuccess: (itemId: string) => void,
      onError: (error: unknown) => void,
    ) => {
      const PluggyConnect = window.PluggyConnect;
      if (!PluggyConnect) {
        onError(new Error("Widget ainda carregando. Tente novamente em instantes."));
        return;
      }

      const widget = new PluggyConnect({
        connectToken,
        onSuccess: (result) => {
          const itemId = result?.item?.id ?? result?.itemId ?? "";
          onSuccess(itemId);
        },
        onError,
      });

      widget.init();
    },
    [],
  );

  return { openWidget };
}
