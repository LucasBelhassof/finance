import { beforeEach, describe, expect, it, vi } from "vitest";

const findBillingUserMock = vi.hoisted(() => vi.fn());
const findSubscriptionByCheckoutIdMock = vi.hoisted(() => vi.fn());
const findSubscriptionByProviderSubscriptionIdMock = vi.hoisted(() => vi.fn());
const findLatestSubscriptionByProviderCustomerIdMock = vi.hoisted(() => vi.fn());
const findCustomerByProviderCustomerIdMock = vi.hoisted(() => vi.fn());
const hasActivePremiumSubscriptionMock = vi.hoisted(() => vi.fn());
const insertBillingAuditLogMock = vi.hoisted(() => vi.fn());
const insertBillingEventMock = vi.hoisted(() => vi.fn());
const refreshUserPremiumCacheMock = vi.hoisted(() => vi.fn());
const updateCustomerProviderIdMock = vi.hoisted(() => vi.fn());
const updateSubscriptionStateMock = vi.hoisted(() => vi.fn());
const noop = vi.hoisted(() => vi.fn());
const sendBillingPaymentFailedEmailMock = vi.hoisted(() => vi.fn());
const sendBillingCanceledEmailMock = vi.hoisted(() => vi.fn());

vi.mock("../../shared/email.js", () => ({
  sendBillingCanceledEmail: sendBillingCanceledEmailMock,
  sendBillingPaymentFailedEmail: sendBillingPaymentFailedEmailMock,
}));

vi.mock("./asaas-client.js", () => ({
  buildAsaasCheckoutUrl: (id: string) => `https://sandbox.asaas.com/checkoutSession/show?id=${id}`,
  cancelAsaasCheckout: noop,
  createAsaasCheckout: noop,
  deleteAsaasSubscription: noop,
  retrieveAsaasSubscription: noop,
}));

vi.mock("./repository.js", () => ({
  createPendingSubscription: noop,
  findBillingUser: findBillingUserMock,
  findCustomerByProviderCustomerId: findCustomerByProviderCustomerIdMock,
  findLatestSubscriptionByProviderCustomerId: findLatestSubscriptionByProviderCustomerIdMock,
  findSubscriptionByCheckoutId: findSubscriptionByCheckoutIdMock,
  findSubscriptionByProviderSubscriptionId: findSubscriptionByProviderSubscriptionIdMock,
  getBillingCustomerForUser: noop,
  getLatestSubscriptionForUser: noop,
  getPremiumPlan: noop,
  hasActivePremiumSubscription: hasActivePremiumSubscriptionMock,
  insertBillingAuditLog: insertBillingAuditLogMock,
  insertBillingEvent: insertBillingEventMock,
  refreshUserPremiumCache: refreshUserPremiumCacheMock,
  updateCustomerProviderId: updateCustomerProviderIdMock,
  updateSubscriptionState: updateSubscriptionStateMock,
  upsertBillingCustomerForUser: noop,
}));

function buildSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    userId: 7,
    customerId: 5,
    planId: "premium_monthly",
    provider: "asaas",
    providerSubscriptionId: "sub_123",
    providerCheckoutId: "checkout_123",
    providerCheckoutUrl: "https://checkout.test",
    status: "pending",
    providerStatus: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    nextDueDate: null,
    activatedAt: null,
    canceledAt: null,
    lastPaymentAt: null,
    metadata: {},
    ...overrides,
  };
}

describe("billing service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertBillingEventMock.mockResolvedValue({ inserted: true });
    findBillingUserMock.mockResolvedValue({ id: 7, name: "Lucas", email: "lucas@example.com" });
    sendBillingPaymentFailedEmailMock.mockResolvedValue({ sent: true });
    sendBillingCanceledEmailMock.mockResolvedValue({ sent: true });
    updateSubscriptionStateMock.mockImplementation(async (id: number, input: { status?: string }) => ({
      ...buildSubscription({ id, status: input.status ?? "pending" }),
    }));
  });

  it("activates premium from a valid Asaas subscription webhook", async () => {
    findSubscriptionByProviderSubscriptionIdMock.mockResolvedValue(buildSubscription());

    const { processAsaasWebhook } = await import("./service.js");

    const result = await processAsaasWebhook({
      id: "evt_1",
      event: "SUBSCRIPTION_UPDATED",
      subscription: {
        id: "sub_123",
        customer: "cus_123",
        status: "ACTIVE",
        nextDueDate: "2026-06-04",
      },
    });

    expect(result).toEqual({ received: true, processed: true });
    expect(updateCustomerProviderIdMock).toHaveBeenCalledWith(5, "cus_123");
    expect(updateSubscriptionStateMock).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        status: "active",
        providerSubscriptionId: "sub_123",
        nextDueDate: "2026-06-04",
      }),
    );
    expect(refreshUserPremiumCacheMock).toHaveBeenCalledWith(7);
  });

  it("ignores duplicated webhook events without changing subscription state", async () => {
    findSubscriptionByProviderSubscriptionIdMock.mockResolvedValue(buildSubscription());
    insertBillingEventMock.mockResolvedValue({ inserted: false });

    const { processAsaasWebhook } = await import("./service.js");
    const result = await processAsaasWebhook({
      id: "evt_1",
      event: "SUBSCRIPTION_UPDATED",
      subscription: { id: "sub_123", status: "ACTIVE" },
    });

    expect(result).toEqual({ received: true, duplicate: true });
    expect(updateSubscriptionStateMock).not.toHaveBeenCalled();
  });

  it("rejects invalid Asaas webhook payloads", async () => {
    const { processAsaasWebhook } = await import("./service.js");

    await expect(processAsaasWebhook({ event: "SUBSCRIPTION_UPDATED" })).rejects.toMatchObject({
      status: 400,
      code: "asaas_webhook_invalid",
    });
  });

  it("removes premium entitlement when a payment becomes overdue", async () => {
    findSubscriptionByProviderSubscriptionIdMock.mockResolvedValue(buildSubscription({ status: "active" }));

    const { processAsaasWebhook } = await import("./service.js");
    await processAsaasWebhook({
      id: "evt_payment_overdue",
      event: "PAYMENT_OVERDUE",
      payment: {
        id: "pay_123",
        subscription: "sub_123",
        customer: "cus_123",
        dueDate: "2026-06-04",
      },
    });

    expect(updateSubscriptionStateMock).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        status: "past_due",
      }),
    );
    expect(refreshUserPremiumCacheMock).toHaveBeenCalledWith(7);
    expect(sendBillingPaymentFailedEmailMock).toHaveBeenCalledWith({
      to: "lucas@example.com",
      name: "Lucas",
    });
  });

  it("blocks premium features for free users and allows premium users", async () => {
    hasActivePremiumSubscriptionMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const { assertPremiumAccess } = await import("./service.js");

    await expect(assertPremiumAccess(7, "ai_chat")).rejects.toMatchObject({
      status: 403,
      code: "premium_required",
    });
    await expect(assertPremiumAccess(7, "ai_chat")).resolves.toBeUndefined();
  });
});
