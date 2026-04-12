import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { configureApiAuth } from "@/lib/api";
import { appRoutes } from "@/lib/routes";
import * as authService from "@/modules/auth/services/auth-service";
import type { AuthSessionPayload, AuthStatus, AuthUser } from "@/modules/auth/types/auth-types";

type AuthContextValue = {
  accessToken: string | null;
  applySession: (payload: AuthSessionPayload) => void;
  bootstrapSession: () => Promise<void>;
  clearSession: () => void;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  refreshAccessToken: () => Promise<string | null>;
  status: AuthStatus;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isPublicAuthRoute(pathname: string) {
  return pathname === appRoutes.login || pathname === appRoutes.forgotPassword || pathname === appRoutes.resetPassword;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const bootstrapPromiseRef = useRef<Promise<void> | null>(null);

  const clearSession = useCallback(() => {
    accessTokenRef.current = null;

    startTransition(() => {
      setAccessToken(null);
      setUser(null);
      setStatus("anonymous");
    });
  }, []);

  const applySession = useCallback((payload: AuthSessionPayload) => {
    accessTokenRef.current = payload.accessToken;

    startTransition(() => {
      setAccessToken(payload.accessToken);
      setUser(payload.user);
      setStatus("authenticated");
    });
  }, []);

  const handleAuthFailure = useCallback(() => {
    clearSession();
    queryClient.clear();

    if (!isPublicAuthRoute(location.pathname)) {
      navigate(appRoutes.login, {
        replace: true,
        state: {
          from: location.pathname,
        },
      });
    }
  }, [clearSession, location.pathname, navigate, queryClient]);

  const refreshAccessToken = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = authService
      .refreshSession()
      .then((payload) => {
        applySession(payload);
        return payload.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  }, [applySession]);

  const bootstrapSession = useCallback(async () => {
    if (bootstrapPromiseRef.current) {
      return bootstrapPromiseRef.current;
    }

    bootstrapPromiseRef.current = authService
      .refreshSession()
      .then((payload) => {
        applySession(payload);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        bootstrapPromiseRef.current = null;
      });

    return bootstrapPromiseRef.current;
  }, [applySession, clearSession]);

  useEffect(() => {
    configureApiAuth({
      getAccessToken: () => accessTokenRef.current,
      onAuthFailure: handleAuthFailure,
      refreshAccessToken,
    });

    return () => {
      configureApiAuth({
        getAccessToken: () => null,
        onAuthFailure: () => undefined,
        refreshAccessToken: async () => null,
      });
    };
  }, [handleAuthFailure, refreshAccessToken]);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      applySession,
      bootstrapSession,
      clearSession,
      isAuthenticated: status === "authenticated",
      isBootstrapping: status === "loading",
      refreshAccessToken,
      status,
      user,
    }),
    [accessToken, applySession, bootstrapSession, clearSession, refreshAccessToken, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used inside AuthProvider.");
  }

  return context;
}
