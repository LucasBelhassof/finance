import { appRoutes } from "@/lib/routes";
import type { AuthUser } from "@/modules/auth/types/auth-types";

export type AuthFlowIntent = "premium";

export type AuthNavigationState = {
  from?: string;
  intent?: AuthFlowIntent;
};

const DISALLOWED_RETURN_ROUTES = new Set([
  appRoutes.login,
  appRoutes.signup,
  appRoutes.forgotPassword,
  appRoutes.resetPassword,
]);

function isInternalPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/");
}

export function normalizeAuthNavigationState(rawState: unknown): AuthNavigationState {
  if (!rawState || typeof rawState !== "object") {
    return {};
  }

  const candidate = rawState as { from?: unknown; intent?: unknown };

  return {
    from: isInternalPath(candidate.from) ? candidate.from : undefined,
    intent: candidate.intent === "premium" ? "premium" : undefined,
  };
}

export function createPremiumAuthState(): AuthNavigationState {
  return {
    from: appRoutes.pricing,
    intent: "premium",
  };
}

export function resolvePostAuthDestination(user: Pick<AuthUser, "role" | "hasCompletedOnboarding">, rawState: unknown) {
  const state = normalizeAuthNavigationState(rawState);
  const shouldPrioritizeOnboarding = user.role !== "admin" && user.hasCompletedOnboarding !== true;

  if (shouldPrioritizeOnboarding) {
    return {
      pathname: appRoutes.onboarding,
      state: state.intent ? state : undefined,
    };
  }

  if (state.intent === "premium") {
    return {
      pathname: appRoutes.pricing,
      state,
    };
  }

  if (state.from && !DISALLOWED_RETURN_ROUTES.has(state.from)) {
    return {
      pathname: state.from,
    };
  }

  return {
    pathname: appRoutes.dashboard,
  };
}
