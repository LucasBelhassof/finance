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
} = vi.hoisted(() => ({
  getAdminActivityMock: vi.fn(),
  getAdminFinancialMetricsMock: vi.fn(),
  getAdminOverviewMock: vi.fn(),
  getAdminSubscriptionMetricsMock: vi.fn(),
  getAdminUsersMock: vi.fn(),
  insertAuditEventMock: vi.fn(),
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

function createTestApp(role: "user" | "admin" = "admin") {
  const app = express();

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
});
