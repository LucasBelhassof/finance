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
  updateAdminUserAccessMock,
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
  updateAdminUserAccessMock: vi.fn(),
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
  updateAdminUserAccess: updateAdminUserAccessMock,
}));

vi.mock("../auth/repository.js", () => ({
  insertAuditEvent: insertAuditEventMock,
}));

vi.mock("../notifications/service.js", () => ({
  createAdminNotification: createAdminNotificationMock,
  listAdminNotificationTargets: listAdminNotificationTargetsMock,
  listAdminNotifications: listAdminNotificationsMock,
}));

const fakeUser = {
  id: 42,
  name: "Usuário Alvo",
  email: "target@finance.test",
  role: "user" as const,
  status: "active" as const,
  isPremium: false,
  createdAt: "2024-01-01T00:00:00.000Z",
  premiumSince: null,
  lastSessionAt: null,
  transactionCount: 0,
  netTotal: 0,
};

function createTestApp(role: "user" | "admin" = "admin") {
  const app = express();
  app.use(express.json());

  app.use((req, _response, next) => {
    req.auth = {
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

describe("PATCH /api/admin/users/:userId/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateAdminUserAccessMock.mockResolvedValue(fakeUser);
  });

  it("bloqueia usuário não-admin", async () => {
    const app = createTestApp("user");

    const res = await request(app).patch("/api/admin/users/42/access").send({ isPremium: true });

    expect(res.status).toBe(403);
    expect(updateAdminUserAccessMock).not.toHaveBeenCalled();
  });

  it("ativa premium com isPremium: true", async () => {
    const app = createTestApp("admin");
    updateAdminUserAccessMock.mockResolvedValue({ ...fakeUser, isPremium: true });

    const res = await request(app).patch("/api/admin/users/42/access").send({ isPremium: true });

    expect(res.status).toBe(200);
    expect(res.body.isPremium).toBe(true);
    expect(updateAdminUserAccessMock).toHaveBeenCalledWith(1, 42, { isPremium: true }, expect.any(Object));
  });

  it("desativa premium com isPremium: false", async () => {
    const app = createTestApp("admin");
    updateAdminUserAccessMock.mockResolvedValue({ ...fakeUser, isPremium: false });

    const res = await request(app).patch("/api/admin/users/42/access").send({ isPremium: false });

    expect(res.status).toBe(200);
    expect(res.body.isPremium).toBe(false);
    expect(updateAdminUserAccessMock).toHaveBeenCalledWith(1, 42, { isPremium: false }, expect.any(Object));
  });

  it("promove usuário para admin com role: admin", async () => {
    const app = createTestApp("admin");
    updateAdminUserAccessMock.mockResolvedValue({ ...fakeUser, role: "admin" });

    const res = await request(app).patch("/api/admin/users/42/access").send({ role: "admin" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
    expect(updateAdminUserAccessMock).toHaveBeenCalledWith(1, 42, { role: "admin" }, expect.any(Object));
  });

  it("rebaixa usuário de admin com role: user", async () => {
    const app = createTestApp("admin");

    const res = await request(app).patch("/api/admin/users/42/access").send({ role: "user" });

    expect(res.status).toBe(200);
    expect(updateAdminUserAccessMock).toHaveBeenCalledWith(1, 42, { role: "user" }, expect.any(Object));
  });

  it("permite atualizar role e isPremium ao mesmo tempo", async () => {
    const app = createTestApp("admin");
    updateAdminUserAccessMock.mockResolvedValue({ ...fakeUser, role: "admin", isPremium: true });

    const res = await request(app).patch("/api/admin/users/42/access").send({ role: "admin", isPremium: true });

    expect(res.status).toBe(200);
    expect(updateAdminUserAccessMock).toHaveBeenCalledWith(
      1,
      42,
      { role: "admin", isPremium: true },
      expect.any(Object),
    );
  });

  it("retorna 403 quando service lança ForbiddenError (self_demotion)", async () => {
    const { ForbiddenError } = await import("../../shared/errors.js");
    updateAdminUserAccessMock.mockRejectedValue(new ForbiddenError("self_demotion", "Não pode remover próprio admin."));
    const app = createTestApp("admin");

    const res = await request(app).patch("/api/admin/users/1/access").send({ role: "user" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("self_demotion");
  });

  it("retorna 403 quando service lança ForbiddenError (last_admin)", async () => {
    const { ForbiddenError } = await import("../../shared/errors.js");
    updateAdminUserAccessMock.mockRejectedValue(new ForbiddenError("last_admin", "Último admin ativo."));
    const app = createTestApp("admin");

    const res = await request(app).patch("/api/admin/users/42/access").send({ role: "user" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("last_admin");
  });

  it("ignora campos desconhecidos no body", async () => {
    const app = createTestApp("admin");

    const res = await request(app)
      .patch("/api/admin/users/42/access")
      .send({ isPremium: true, unknownField: "ignored" });

    expect(res.status).toBe(200);
    // Apenas campos conhecidos repassados ao service
    expect(updateAdminUserAccessMock).toHaveBeenCalledWith(1, 42, { isPremium: true }, expect.any(Object));
  });

  it("retorna 400 para role inválido", async () => {
    const app = createTestApp("admin");

    const res = await request(app).patch("/api/admin/users/42/access").send({ role: "superuser" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_role");
    expect(updateAdminUserAccessMock).not.toHaveBeenCalled();
  });

  it("retorna 400 quando isPremium é string em vez de boolean", async () => {
    const app = createTestApp("admin");

    const res = await request(app).patch("/api/admin/users/42/access").send({ isPremium: "true" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_is_premium");
    expect(updateAdminUserAccessMock).not.toHaveBeenCalled();
  });

  it("retorna 400 para userId não numérico", async () => {
    const app = createTestApp("admin");

    const res = await request(app).patch("/api/admin/users/abc/access").send({ isPremium: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_user_id");
    expect(updateAdminUserAccessMock).not.toHaveBeenCalled();
  });

  it("auditoria chamada via service no sucesso", async () => {
    const app = createTestApp("admin");

    await request(app).patch("/api/admin/users/42/access").send({ isPremium: true });

    // insertAuditEvent é chamado dentro do service (mockado via service.js)
    // Verificamos que o service foi chamado com os parâmetros corretos
    expect(updateAdminUserAccessMock).toHaveBeenCalledOnce();
  });
});
