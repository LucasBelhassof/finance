import { useAuthContext } from "@/modules/auth/components/AuthProvider";

export function useBootstrapSession() {
  const { bootstrapSession, isBootstrapping, status } = useAuthContext();

  return {
    bootstrapSession,
    isBootstrapping,
    status,
  };
}
