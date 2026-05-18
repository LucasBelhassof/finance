import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthContext } from "@/modules/auth/components/AuthProvider";
import { resolvePostAuthDestination } from "@/modules/auth/lib/auth-navigation";
import { signup } from "@/modules/auth/services/auth-service";
import type { SignupInput } from "@/modules/auth/types/auth-types";

export function useSignup() {
  const location = useLocation();
  const navigate = useNavigate();
  const { applySession } = useAuthContext();

  return useMutation({
    mutationFn: (input: SignupInput) => signup(input),
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
