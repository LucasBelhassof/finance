import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isHttpError, toHttpError } from "../../shared/errors.js";
import { createNotificationsRouter } from "./routes.js";

const {
  createSelfNotificationMock,
  listNotificationsForUserMock,
  markAllNotificationsAsReadMock,
  markNotificationAsReadMock,
} = vi.hoisted(() => ({
  createSelfNotificationMock: vi.fn(),
  listNotificationsForUserMock: vi.fn(),
  markAllNotificationsAsReadMock: vi.fn(),
  markNotificationAsReadMock: vi.fn(),
}));

vi.mock("./service.js", () => ({
  createSelfNotification: createSelfNotificationMock,
  listNotificationsForUser: listNotificationsForUserMock,
  markAllNotificationsAsRead: markAllNotificationsAsReadMock,
  markNotificationAsRead: markNotificationAsReadMock,
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
  app.use("/api/notifications", createNotificationsRouter());
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const normalizedError = isHttpError(error) ? error : toHttpError(error);
    response.status(normalizedError.status).json({
      error: normalizedError.code,
      message: normalizedError.message,
    });
  });

  return app;
}

describe("notifications routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listNotificationsForUserMock.mockResolvedValue({
      unreadCount: 1,
      notifications: [],
    });
    createSelfNotificationMock.mockResolvedValue(99);
    markAllNotificationsAsReadMock.mockResolvedValue({ updatedCount: 2 });
    markNotificationAsReadMock.mockResolvedValue(undefined);
  });

  it("lists notifications for the authenticated user", async () => {
    const app = createTestApp();

    const response = await request(app).get("/api/notifications?limit=10&unreadOnly=true");

    expect(response.status).toBe(200);
    expect(listNotificationsForUserMock).toHaveBeenCalledWith(7, {
      limit: "10",
      unreadOnly: "true",
    });
  });

  it("creates a self notification", async () => {
    const app = createTestApp();

    const response = await request(app).post("/api/notifications/self").send({
      title: "Lembrete",
      message: "Pagar fatura",
      category: "invoice_due",
    });

    expect(response.status).toBe(201);
    expect(createSelfNotificationMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        title: "Lembrete",
        message: "Pagar fatura",
      }),
    );
  });

  it("marks all notifications as read", async () => {
    const app = createTestApp();

    const response = await request(app).patch("/api/notifications/read-all");

    expect(response.status).toBe(200);
    expect(markAllNotificationsAsReadMock).toHaveBeenCalledWith(7);
    expect(response.body).toEqual({ updatedCount: 2 });
  });
});
