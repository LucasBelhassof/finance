import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";
import { login } from "@/modules/auth/services/auth-service";
import type { LoginInput } from "@/modules/auth/types/auth-types";

export function useLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const { applySession } = useAuthContext();

  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (payload) => {
      applySession(payload);

      const state = location.state as { from?: string } | null;
      navigate(state?.from || appRoutes.dashboard, { replace: true });
    },
  });
}
