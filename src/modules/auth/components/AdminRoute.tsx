import { Navigate, Outlet, useLocation } from "react-router-dom";

import { AppBootLoader } from "@/components/AppBootLoader";
import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";

export function AdminRoute() {
  const location = useLocation();
  const { isAuthenticated, isBootstrapping, user } = useAuthContext();

  if (isBootstrapping) {
    return <AppBootLoader />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={appRoutes.login}
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  if (user?.role !== "admin") {
    return <Navigate to={appRoutes.dashboard} replace />;
  }

  return <Outlet />;
}
