import { useAuthContext } from "@/modules/auth/components/AuthProvider";

export function useAuthSession() {
  return useAuthContext();
}
