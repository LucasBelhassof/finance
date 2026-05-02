import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isHttpError, toHttpError } from "../../shared/errors.js";
import { createInvoicesRouter } from "./routes.js";

const { listInvoicesForUserMock, updateInvoiceSettingsForCardMock } = vi.hoisted(() => ({
  listInvoicesForUserMock: vi.fn(),
  updateInvoiceSettingsForCardMock: vi.fn(),
}));

vi.mock("./service.js", () => ({
  listInvoicesForUser: listInvoicesForUserMock,
  updateInvoiceSettingsForCard: updateInvoiceSettingsForCardMock,
}));

function createTestApp() {
  const app = express();

  app.use(express.json());
  app.use((request, _response, next) => {
    request.auth = {
      userId: 7,
      user: {
        id: 7,
        name: "User",
        email: "user@finance.test",
        emailVerified: true,
        hasCompletedOnboarding: true,
        onboardingProgress: {
          currentStep: 3,
          completedSteps: ["profile", "account", "due_dates", "dashboard"],
          skippedSteps: [],
          dismissed: false,
        },
        role: "user",
        status: "active",
        isPremium: false,
        premiumSince: null,
      },
    };
    next();
  });
  app.use("/api/invoices", createInvoicesRouter());
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const normalizedError = isHttpError(error) ? error : toHttpError(error);
    response.status(normalizedError.status).json({
      error: normalizedError.code,
      message: normalizedError.message,
    });
  });

  return app;
}

describe("invoices routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listInvoicesForUserMock.mockResolvedValue({
      appliedFilters: {},
      summary: {},
      filterOptions: {},
      invoices: [],
    });
    updateInvoiceSettingsForCardMock.mockResolvedValue({
      id: 2,
      name: "Nubank",
    });
  });

  it("lists invoices for the authenticated user with filters", async () => {
    const app = createTestApp();

    const response = await request(app).get(
      "/api/invoices?cardId=2&referenceStart=2026-04-01&referenceEnd=2026-04-30&status=closed&categoryId=7&search=mercado",
    );

    expect(response.status).toBe(200);
    expect(listInvoicesForUserMock).toHaveBeenCalledWith(7, {
      cardId: "2",
      referenceStart: "2026-04-01",
      referenceEnd: "2026-04-30",
      status: "closed",
      categoryId: "7",
      search: "mercado",
    });
  });

  it("updates settings only for the authenticated user's card", async () => {
    const app = createTestApp();

    const payload = {
      statementCloseDay: 10,
      statementDueDay: 20,
      notifyInvoiceClosed: true,
      notifyInvoiceDueSoon: true,
      invoiceDueReminderDays: 5,
    };
    const response = await request(app).patch("/api/invoices/cards/2/settings").send(payload);

    expect(response.status).toBe(200);
    expect(updateInvoiceSettingsForCardMock).toHaveBeenCalledWith(7, 2, payload);
    expect(response.body).toEqual({
      card: {
        id: 2,
        name: "Nubank",
      },
    });
  });

  it("rejects invalid card ids", async () => {
    const app = createTestApp();

    const response = await request(app).patch("/api/invoices/cards/abc/settings").send({});

    expect(response.status).toBe(400);
    expect(updateInvoiceSettingsForCardMock).not.toHaveBeenCalled();
  });
});
