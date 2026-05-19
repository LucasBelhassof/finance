import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AppShell from "@/components/AppShell";
import { appRoutes } from "@/lib/routes";

const { logoutMutateAsync, restartTourMock, useIsMobileMock } = vi.hoisted(() => ({
  logoutMutateAsync: vi.fn(),
  restartTourMock: vi.fn(),
  useIsMobileMock: vi.fn(),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

vi.mock("@/modules/auth/hooks/use-auth-session", () => ({
  useAuthSession: () => ({
    user: {
      name: "Joao Silva",
      email: "joao@finance.test",
      role: "user",
      isPremium: true,
    },
  }),
}));

vi.mock("@/modules/auth/hooks/use-logout", () => ({
  useLogout: () => ({
    isPending: false,
    mutateAsync: logoutMutateAsync,
  }),
}));

vi.mock("@/modules/product-tour/use-product-tour", () => ({
  useProductTour: () => ({
    restartTour: restartTourMock,
  }),
}));

vi.mock("@/components/NotificationBell", () => ({
  NotificationBell: () => <button type="button">Notificações</button>,
}));

function renderShell(initialPath: string, children: ReactNode = <div>Conteúdo</div>) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppShell title="Painel" description="Resumo">
        {children}
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    logoutMutateAsync.mockReset();
    restartTourMock.mockReset();
    useIsMobileMock.mockReset();
  });

  it("renders the mobile bottom navigation with the primary shortcuts", () => {
    useIsMobileMock.mockReturnValue(true);

    renderShell(appRoutes.dashboard);

    expect(screen.getByRole("navigation", { name: /navegação principal mobile/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Transações" })).toHaveAttribute("href", appRoutes.transactions);
    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("href", appRoutes.chat);
    expect(screen.getByRole("link", { name: "Planos" })).toHaveAttribute("href", appRoutes.plans);
    expect(screen.getByRole("button", { name: /abrir mais opções/i })).toBeInTheDocument();
  });

  it("marks nested plan routes in the mobile navigation", () => {
    useIsMobileMock.mockReturnValue(true);

    renderShell("/plans/abc123");

    expect(screen.getByRole("link", { name: "Planos" })).toHaveAttribute("aria-current", "page");
  });

  it("marks the more button when the current route is outside the primary mobile shortcuts", () => {
    useIsMobileMock.mockReturnValue(true);

    renderShell(appRoutes.accounts);

    expect(screen.getByRole("button", { name: /abrir mais opções/i })).toHaveAttribute("aria-current", "page");
  });

  it("opens the sidebar sheet from the more button on mobile", () => {
    useIsMobileMock.mockReturnValue(true);

    renderShell(appRoutes.dashboard);

    fireEvent.click(screen.getByRole("button", { name: /abrir mais opções/i }));

    expect(screen.getByRole("button", { name: /fechar menu/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contas" })).toBeInTheDocument();
  });

  it("does not render the mobile bottom navigation on desktop", () => {
    useIsMobileMock.mockReturnValue(false);

    renderShell(appRoutes.dashboard);

    expect(screen.queryByRole("navigation", { name: /navegação principal mobile/i })).not.toBeInTheDocument();
  });
});
