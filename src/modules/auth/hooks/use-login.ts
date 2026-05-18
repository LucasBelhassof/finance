import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthContext } from "@/modules/auth/components/AuthProvider";
import { resolvePostAuthDestination } from "@/modules/auth/lib/auth-navigation";
import { login } from "@/modules/auth/services/auth-service";
import type { LoginInput } from "@/modules/auth/types/auth-types";

const MINIMUM_LOGIN_LOADER_MS = 2400;

function wait(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export function useLogin() {
  const location = useLocation();
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
      const destination = resolvePostAuthDestination(payload.user, location.state);
      navigate(destination.pathname, {
        replace: true,
        state: destination.state,
      });
    },
  });
}
