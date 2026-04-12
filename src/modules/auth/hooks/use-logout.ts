import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";
import { logout } from "@/modules/auth/services/auth-service";

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clearSession } = useAuthContext();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearSession();
      queryClient.clear();
      navigate(appRoutes.login, { replace: true });
    },
  });
}
