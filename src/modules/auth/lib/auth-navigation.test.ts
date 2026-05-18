import { describe, expect, it } from "vitest";

import { appRoutes } from "@/lib/routes";
import {
  createPremiumAuthState,
  normalizeAuthNavigationState,
  resolvePostAuthDestination,
} from "@/modules/auth/lib/auth-navigation";

describe("auth navigation helpers", () => {
  it("normalizes the premium state used by the pricing flow", () => {
    expect(createPremiumAuthState()).toEqual({
      from: appRoutes.pricing,
      intent: "premium",
    });
  });

  it("ignores malformed external state", () => {
    expect(normalizeAuthNavigationState({ from: "https://external", intent: "other" })).toEqual({});
  });

  it("prioritizes onboarding for incomplete regular users", () => {
    expect(
      resolvePostAuthDestination(
        {
          role: "user",
          hasCompletedOnboarding: false,
        },
        createPremiumAuthState(),
      ),
    ).toEqual({
      pathname: appRoutes.onboarding,
      state: createPremiumAuthState(),
    });
  });

  it("returns premium users in the premium flow back to pricing after auth", () => {
    expect(
      resolvePostAuthDestination(
        {
          role: "user",
          hasCompletedOnboarding: true,
        },
        createPremiumAuthState(),
      ),
    ).toEqual({
      pathname: appRoutes.pricing,
      state: createPremiumAuthState(),
    });
  });

  it("returns protected-route users to their original destination when valid", () => {
    expect(
      resolvePostAuthDestination(
        {
          role: "user",
          hasCompletedOnboarding: true,
        },
        { from: appRoutes.accounts },
      ),
    ).toEqual({
      pathname: appRoutes.accounts,
    });
  });
});
