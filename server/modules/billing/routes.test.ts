import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isHttpError, toHttpError } from "../../shared/errors.js";
import { createAsaasWebhookRouter, createBillingRouter, requirePremiumFeature } from "./routes.js";

const {
  assertPremiumAccessMock,
  cancelBillingSubscriptionMock,
  createBillingCheckoutMock,
  getBillingSubscriptionMock,
  processAsaasWebhookMock,
  syncBillingSubscriptionMock,
} = vi.hoisted(() => ({
  assertPremiumAccessMock: vi.fn(),
  cancelBillingSubscriptionMock: vi.fn(),
  createBillingCheckoutMock: vi.fn(),
  getBillingSubscriptionMock: vi.fn(),
  processAsaasWebhookMock: vi.fn(),
  syncBillingSubscriptionMock: vi.fn(),
}));

vi.mock("../../shared/env.js", () => ({
  env: {
    billing: {
      asaasWebhookToken: "valid-webhook-token",
    },
  },
}));

vi.mock("./service.js", () => ({
  assertImportWithinFreeLimit: vi.fn(),
  assertPremiumAccess: assertPremiumAccessMock,
  cancelBillingSubscription: cancelBillingSubscriptionMock,
  createBillingCheckout: createBillingCheckoutMock,
  getBillingSubscription: getBillingSubscriptionMock,
  processAsaasWebhook: processAsaasWebhookMock,
  syncBillingSubscription: syncBillingSubscriptionMock,
}));

function attachErrorHandler(app: express.Express) {
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const normalizedError = isHttpError(error) ? error : toHttpError(error);

    response.status(normalizedError.status).json({
      error: normalizedError.code,
      message: normalizedError.message,
    });
  });
}

function createAuthenticatedBillingApp() {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.auth = {
      userId: 42,
      user: {
        id: 42,
        name: "Lucas",
        email: "lucas@example.com",
        emailVerified: true,
        role: "user",
        status: "active",
        isPremium: false,
        premiumSince: null,
      },
    };
    next();
  });
  app.use("/api/billing", createBillingRouter());
  attachErrorHandler(app);
  return app;
}

describe("billing routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBillingSubscriptionMock.mockResolvedValue({ isPremium: false, status: "inactive" });
    createBillingCheckoutMock.mockResolvedValue({
      checkoutUrl: "https://sandbox.asaas.com/checkoutSession/show?id=checkout_123",
      subscription: { isPremium: false, status: "pending" },
    });
    cancelBillingSubscriptionMock.mockResolvedValue({ isPremium: false, status: "canceled" });
    syncBillingSubscriptionMock.mockResolvedValue({ isPremium: true, status: "active" });
    processAsaasWebhookMock.mockResolvedValue({ received: true, processed: true });
  });

  it("uses the authenticated user id for subscription reads", async () => {
    const app = createAuthenticatedBillingApp();

    const response = await request(app).get("/api/billing/subscription");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ isPremium: false, status: "inactive" });
    expect(getBillingSubscriptionMock).toHaveBeenCalledWith(42);
  });

  it("rejects Asaas webhooks without the configured token", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/webhooks/asaas", createAsaasWebhookRouter());
    attachErrorHandler(app);

    const response = await request(app).post("/api/webhooks/asaas").send({
      id: "evt_1",
      event: "SUBSCRIPTION_UPDATED",
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("asaas_webhook_forbidden");
    expect(processAsaasWebhookMock).not.toHaveBeenCalled();
  });

  it("accepts Asaas webhooks with the configured token", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/webhooks/asaas", createAsaasWebhookRouter());
    attachErrorHandler(app);

    const response = await request(app)
      .post("/api/webhooks/asaas")
      .set("asaas-access-token", "valid-webhook-token")
      .send({
        id: "evt_1",
        event: "SUBSCRIPTION_UPDATED",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, processed: true });
    expect(processAsaasWebhookMock).toHaveBeenCalledWith({
      id: "evt_1",
      event: "SUBSCRIPTION_UPDATED",
    });
  });

  it("checks premium entitlement before guarded handlers run", async () => {
    const app = express();
    app.use((request, _response, next) => {
      request.auth = {
        userId: 42,
        user: {
          id: 42,
          name: "Lucas",
          email: "lucas@example.com",
          emailVerified: true,
          role: "user",
          status: "active",
          isPremium: false,
          premiumSince: null,
        },
      };
      next();
    });
    app.get("/premium", requirePremiumFeature("ai_chat"), (_request, response) => {
      response.json({ ok: true });
    });
    attachErrorHandler(app);

    let response = await request(app).get("/premium");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(assertPremiumAccessMock).toHaveBeenCalledWith(42, "ai_chat");

    assertPremiumAccessMock.mockRejectedValueOnce(
      Object.assign(new Error("Premium required."), {
        status: 403,
        code: "premium_required",
      }),
    );

    response = await request(app).get("/premium");

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("premium_required");
  });
});
