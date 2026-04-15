import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Sidebar from "@/components/Sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { appRoutes } from "@/lib/routes";

const { logoutMutateAsync, useAuthSessionMock } = vi.hoisted(() => ({
  logoutMutateAsync: vi.fn(),
  useAuthSessionMock: vi.fn(),
}));

vi.mock("@/modules/auth/hooks/use-auth-session", () => ({
  useAuthSession: useAuthSessionMock,
}));

vi.mock("@/modules/auth/hooks/use-logout", () => ({
  useLogout: () => ({
    isPending: false,
    mutateAsync: logoutMutateAsync,
  }),
}));

function renderSidebar(initialPath = appRoutes.dashboard) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SidebarProvider>
        <Sidebar />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

function getClosestElement<T extends HTMLElement>(textPattern: RegExp, selector: string) {
  const element = screen.getByText(textPattern).closest(selector);

  if (!element) {
    throw new Error(`Could not find closest ${selector} for ${textPattern.toString()}.`);
  }

  return element as T;
}

describe("Sidebar", () => {
  beforeEach(() => {
    useAuthSessionMock.mockReturnValue({
      user: {
        name: "Joao Silva",
        email: "joao@finance.test",
        role: "user",
      },
    });
  });

  it("places transactions as the first expense management submenu item", () => {
    renderSidebar();

    fireEvent.click(getClosestElement<HTMLButtonElement>(/gest/i, "button"));

    const transactionsLink = getClosestElement<HTMLAnchorElement>(/^trans/i, "a");
    const installmentsLink = getClosestElement<HTMLAnchorElement>(/^parcel/i, "a");

    expect(transactionsLink).toHaveAttribute("href", appRoutes.transactions);
    expect(transactionsLink.compareDocumentPosition(installmentsLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("renders the expense management submenu and links", () => {
    renderSidebar();

    const expenseManagementButton = getClosestElement<HTMLButtonElement>(/gest/i, "button");

    fireEvent.click(expenseManagementButton);

    expect(expenseManagementButton).toBeInTheDocument();
    expect(getClosestElement<HTMLAnchorElement>(/^trans/i, "a")).toHaveAttribute("href", appRoutes.transactions);
    expect(getClosestElement<HTMLAnchorElement>(/^parcel/i, "a")).toHaveAttribute("href", appRoutes.expenseManagementInstallments);
    expect(getClosestElement<HTMLAnchorElement>(/^hab/i, "a")).toHaveAttribute("href", appRoutes.expenseManagementHousing);
    expect(getClosestElement<HTMLAnchorElement>(/^m/i, "a")).toHaveAttribute("href", appRoutes.expenseManagementMetrics);
  });

  it("opens and marks expense management active on nested routes", () => {
    renderSidebar(appRoutes.expenseManagementInstallments);

    expect(getClosestElement<HTMLButtonElement>(/gest/i, "button")).toHaveAttribute("data-active", "true");
    expect(getClosestElement<HTMLAnchorElement>(/^parcel/i, "a")).toHaveAttribute("data-active", "true");
  });

  it("renders the admin submenu only for admin users", () => {
    useAuthSessionMock.mockReturnValue({
      user: {
        name: "Admin Silva",
        email: "admin@finance.test",
        role: "admin",
      },
    });

    renderSidebar(appRoutes.adminOverview);

    expect(getClosestElement<HTMLAnchorElement>(/visao geral/i, "a")).toHaveAttribute("href", appRoutes.adminOverview);
  });

  it("shows the first steps item while onboarding is pending", () => {
    useAuthSessionMock.mockReturnValue({
      user: {
        name: "Joao Silva",
        email: "joao@finance.test",
        role: "user",
        hasCompletedOnboarding: false,
      },
    });

    renderSidebar();

    expect(getClosestElement<HTMLAnchorElement>(/primeiros passos/i, "a")).toHaveAttribute("href", appRoutes.onboarding);
  });

  it("hides the first steps item after onboarding is completed", () => {
    useAuthSessionMock.mockReturnValue({
      user: {
        name: "Joao Silva",
        email: "joao@finance.test",
        role: "user",
        hasCompletedOnboarding: true,
      },
    });

    renderSidebar();

    expect(screen.queryByText(/primeiros passos/i)).not.toBeInTheDocument();
  });
});
