import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PricingPage from "@/pages/Pricing";
import { appRoutes } from "@/lib/routes";
import { createPremiumAuthState } from "@/modules/auth/lib/auth-navigation";

const mockNavigate = vi.fn();
const mockCompleteActionStep = vi.fn();
const mockUseAuthSession = vi.fn();
const mockUseLocation = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
  };
});

vi.mock("@/modules/auth/hooks/use-auth-session", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

vi.mock("@/modules/auth/hooks/use-action-onboarding-progress", () => ({
  useActionOnboardingProgress: () => ({
    completeActionStep: mockCompleteActionStep,
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    className,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: ReactNode; className?: string }) => (
    <section className={className}>{children}</section>
  ),
  CardHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardFooter: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <PricingPage />
    </MemoryRouter>,
  );
}

describe("PricingPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCompleteActionStep.mockReset();
    mockUseLocation.mockReturnValue({ state: null });
    mockUseAuthSession.mockReturnValue({
      user: {
        id: 1,
        isPremium: false,
        hasCompletedOnboarding: false,
      },
    });
  });

  it("marks the premium checklist step as complete for authenticated users", () => {
    renderPage();

    expect(mockCompleteActionStep).toHaveBeenCalledWith("premium");
  });

  it("sends incomplete authenticated users to onboarding from the premium CTA", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Concluir primeiros passos/i }));

    expect(mockNavigate).toHaveBeenCalledWith(appRoutes.onboarding, {
      state: createPremiumAuthState(),
    });
  });

  it("sends unauthenticated users to signup from the free CTA", () => {
    mockUseAuthSession.mockReturnValue({
      user: null,
    });

    renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: /Começar grátis/i })[0]!);

    expect(mockNavigate).toHaveBeenCalledWith(appRoutes.signup);
  });

  it("preserves premium intent for unauthenticated users coming from pricing", () => {
    mockUseAuthSession.mockReturnValue({
      user: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Criar conta para continuar/i }));

    expect(mockNavigate).toHaveBeenCalledWith(appRoutes.signup, {
      state: createPremiumAuthState(),
    });
  });

  it("sends configured free users to profile from the premium CTA", () => {
    mockUseAuthSession.mockReturnValue({
      user: {
        id: 1,
        isPremium: false,
        hasCompletedOnboarding: true,
      },
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Ver status do Premium/i }));

    expect(mockNavigate).toHaveBeenCalledWith(appRoutes.profile);
  });
});
