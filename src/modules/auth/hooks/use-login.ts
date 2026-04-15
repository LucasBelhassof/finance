import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";
import { login } from "@/modules/auth/services/auth-service";
import type { LoginInput } from "@/modules/auth/types/auth-types";

const MINIMUM_LOGIN_LOADER_MS = 2400;

function wait(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export function useLogin() {
  const navigate = useNavigate();
  const { applySession } = useAuthContext();

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const startedAt = Date.now();
      const payload = await login(input);
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = Math.max(0, MINIMUM_LOGIN_LOADER_MS - elapsedMs);

      if (remainingMs > 0) {
        await wait(remainingMs);
      }

      return payload;
    },
    onSuccess: (payload) => {
      applySession(payload);
      navigate(appRoutes.dashboard, { replace: true });
    },
  });
}
