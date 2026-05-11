import { expect, test, type Page, type Route } from "@playwright/test";

type MockUser = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "inactive" | "suspended";
  isPremium: boolean;
  premiumSince?: string | null;
  emailVerified?: boolean;
  hasCompletedOnboarding: boolean;
  onboardingProgress: {
    currentStep: number;
    completedSteps: string[];
    skippedSteps: string[];
    dismissed: boolean;
    actionChecklist?: {
      completedSteps: string[];
    };
  };
};

function buildUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 401,
    name: "Lucas Dados",
    email: "lucas.dados@finly.app",
    role: "user",
    status: "active",
    isPremium: false,
    premiumSince: null,
    emailVerified: true,
    hasCompletedOnboarding: true,
    onboardingProgress: {
      currentStep: 5,
      completedSteps: ["welcome"],
      skippedSteps: [],
      dismissed: false,
      actionChecklist: {
        completedSteps: ["accounts", "transactions", "categories", "dashboard", "premium"],
      },
    },
    ...overrides,
  };
}

function buildSessionPayload(user: MockUser) {
  return {
    user,
    accessToken: "data-controls-e2e-token",
    expiresAt: "2030-01-01T00:00:00.000Z",
  };
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockDataControlsApi(
  page: Page,
  options: {
    user?: MockUser;
  } = {},
) {
  const user = options.user ?? buildUser();

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (pathname === "/api/auth/refresh" && request.method() === "POST") {
      await fulfillJson(route, 200, buildSessionPayload(user));
      return;
    }

    if (pathname === "/api/dashboard" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        user,
        referenceMonth: "2026-05",
        summaryCards: [],
        recentTransactions: [],
        spendingByCategory: [],
        insights: [],
        banks: [],
        chatMessages: [],
      });
      return;
    }

    if (pathname === "/api/health" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        status: "ok",
        database: "connected",
        serverTime: "2026-05-11T12:00:00.000Z",
      });
      return;
    }

    if (pathname === "/api/notifications" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        unreadCount: 0,
        notifications: [],
      });
      return;
    }

    if (pathname === "/api/user-data/export/csv" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "text/csv",
        body: "date,description,amount\n2026-05-01,Salario,2500.00\n",
      });
      return;
    }

    if (pathname === "/api/user-data/export/json" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
          },
          transactions: [],
          banks: [],
        }),
      });
      return;
    }

    if (pathname === "/api/user-data/account" && request.method() === "DELETE") {
      const body = request.postDataJSON() as { currentPassword?: string } | null;

      if (body?.currentPassword === "senha-correta") {
        await route.fulfill({
          status: 204,
          body: "",
        });
        return;
      }

      await fulfillJson(route, 403, {
        error: "invalid_password",
        message: "Senha incorreta. Tente novamente.",
      });
      return;
    }

    throw new Error(`Unhandled API request in data controls smoke: ${request.method()} ${pathname}`);
  });
}

test.describe("data controls smoke", () => {
  test("authenticated users can access data export controls and export CSV and JSON", async ({ page }) => {
    await mockDataControlsApi(page);

    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Configurações", exact: true })).toBeVisible();
    await expect(page.getByText("Exportar dados")).toBeVisible();

    const csvResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/user-data/export/csv") && response.request().method() === "GET",
    );
    await page.getByRole("button", { name: "Exportar transações (CSV)" }).click();
    const csvResponse = await csvResponsePromise;
    expect(csvResponse.ok()).toBeTruthy();

    const jsonResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/user-data/export/json") && response.request().method() === "GET",
    );
    await page.getByRole("button", { name: "Exportar todos os dados (JSON)" }).click();
    const jsonResponse = await jsonResponsePromise;
    expect(jsonResponse.ok()).toBeTruthy();
  });

  test("account deletion requires password confirmation and blocks wrong password", async ({ page }) => {
    await mockDataControlsApi(page);

    await page.goto("/settings");

    await page.getByRole("button", { name: "Excluir minha conta" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Excluir conta permanentemente")).toBeVisible();

    const confirmButton = dialog.getByRole("button", { name: "Excluir minha conta" });
    await expect(confirmButton).toBeDisabled();

    await dialog.getByPlaceholder("Sua senha").fill("senha-incorreta");
    await expect(confirmButton).toBeEnabled();

    const deleteResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/user-data/account") && response.request().method() === "DELETE",
    );
    await confirmButton.click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(403);

    await expect(dialog.getByText("Senha incorreta. Tente novamente.")).toBeVisible();
    await expect(page).toHaveURL(/\/settings$/);
  });
});
