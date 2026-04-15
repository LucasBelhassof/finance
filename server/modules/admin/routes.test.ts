import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isHttpError, toHttpError } from "../../shared/errors.js";
import { createAdminRouter } from "./routes.js";

const {
  getAdminActivityMock,
  getAdminFinancialMetricsMock,
  getAdminOverviewMock,
  getAdminSubscriptionMetricsMock,
  getAdminUsersMock,
  insertAuditEventMock,
  createAdminNotificationMock,
  listAdminNotificationTargetsMock,
  listAdminNotificationsMock,
} = vi.hoisted(() => ({
  getAdminActivityMock: vi.fn(),
  getAdminFinancialMetricsMock: vi.fn(),
  getAdminOverviewMock: vi.fn(),
  getAdminSubscriptionMetricsMock: vi.fn(),
  getAdminUsersMock: vi.fn(),
  insertAuditEventMock: vi.fn(),
  createAdminNotificationMock: vi.fn(),
  listAdminNotificationTargetsMock: vi.fn(),
  listAdminNotificationsMock: vi.fn(),
}));

vi.mock("./service.js", () => ({
  getAdminActivity: getAdminActivityMock,
  getAdminFinancialMetrics: getAdminFinancialMetricsMock,
  getAdminOverview: getAdminOverviewMock,
  getAdminSubscriptionMetrics: getAdminSubscriptionMetricsMock,
  getAdminUsers: getAdminUsersMock,
}));

vi.mock("../auth/repository.js", () => ({
  insertAuditEvent: insertAuditEventMock,
}));

vi.mock("../notifications/service.js", () => ({
  createAdminNotification: createAdminNotificationMock,
  listAdminNotificationTargets: listAdminNotificationTargetsMock,
  listAdminNotifications: listAdminNotificationsMock,
}));

function createTestApp(role: "user" | "admin" = "admin") {
  const app = express();
  app.use(express.json());

  app.use((request, _response, next) => {
    request.auth = {
      userId: 1,
      user: {
        id: 1,
        name: "Admin",
        email: "admin@finance.test",
        emailVerified: true,
        role,
        status: "active",
        isPremium: true,
        premiumSince: null,
      },
    };
    next();
  });
  app.use("/api/admin", createAdminRouter());
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const normalizedError = isHttpError(error) ? error : toHttpError(error);

    response.status(normalizedError.status).json({
      error: normalizedError.code,
      message: normalizedError.message,
    });
  });

  return app;
}

describe("admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminOverviewMock.mockResolvedValue({ totals: { totalUsers: 1 }, period: {}, signups: [] });
    getAdminUsersMock.mockResolvedValue({ page: 1, pageSize: 20, total: 1, users: [] });
    getAdminFinancialMetricsMock.mockResolvedValue({ period: {}, summary: {}, monthlySeries: [], topUsers: [] });
    getAdminSubscriptionMetricsMock.mockResolvedValue({ period: {}, summary: {}, evolution: [] });
    getAdminActivityMock.mockResolvedValue({ events: [] });
    listAdminNotificationTargetsMock.mockResolvedValue({ users: [] });
    listAdminNotificationsMock.mockResolvedValue({ notifications: [] });
    createAdminNotificationMock.mockResolvedValue({ notificationId: 10, recipientsCount: 2 });
  });

  it("returns overview for admin users", async () => {
    const app = createTestApp("admin");

    const response = await request(app).get("/api/admin/overview");

    expect(response.status).toBe(200);
    expect(getAdminOverviewMock).toHaveBeenCalled();
    expect(insertAuditEventMock).toHaveBeenCalled();
  });

  it("blocks non-admin users", async () => {
    const app = createTestApp("user");

    const response = await request(app).get("/api/admin/overview");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "admin_required",
      message: "Admin access is required.",
    });
    expect(getAdminOverviewMock).not.toHaveBeenCalled();
  });

  it("creates notifications for admin users", async () => {
    const app = createTestApp("admin");

    const response = await request(app).post("/api/admin/notifications").send({
      title: "Comunicado",
      message: "Sistema atualizado.",
      target: {
        mode: "all",
        audience: "premium",
      },
    });

    expect(response.status).toBe(201);
    expect(createAdminNotificationMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: "Comunicado",
        target: expect.objectContaining({
          audience: "premium",
        }),
      }),
    );
  });

  it("allows sending system notifications to selected users", async () => {
    const app = createTestApp("admin");

    const response = await request(app).post("/api/admin/notifications").send({
      title: "Aviso",
      message: "Atualize o aplicativo.",
      category: "custom",
      target: {
        mode: "selected",
        userIds: [4, 8, 12],
      },
    });

    expect(response.status).toBe(201);
    expect(createAdminNotificationMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        category: "custom",
        target: expect.objectContaining({
          mode: "selected",
          userIds: [4, 8, 12],
        }),
      }),
    );
  });
});
