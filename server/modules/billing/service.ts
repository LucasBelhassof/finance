import { randomUUID } from "node:crypto";

import { env } from "../../shared/env.js";
import { sendBillingCanceledEmail, sendBillingPaymentFailedEmail } from "../../shared/email.js";
import { BadRequestError, ForbiddenError, HttpError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import {
  buildAsaasCheckoutUrl,
  cancelAsaasCheckout,
  createAsaasCheckout,
  deleteAsaasSubscription,
  retrieveAsaasSubscription,
} from "./asaas-client.js";
import {
  createPendingSubscription,
  findBillingUser,
  findCustomerByProviderCustomerId,
  findLatestSubscriptionByProviderCustomerId,
  findSubscriptionByCheckoutId,
  findSubscriptionByProviderSubscriptionId,
  getBillingCustomerForUser,
  getLatestSubscriptionForUser,
  getPremiumPlan,
  hasActivePremiumSubscription,
  insertBillingAuditLog,
  insertBillingEvent,
  refreshUserPremiumCache,
  updateCustomerProviderId,
  updateSubscriptionState,
  upsertBillingCustomerForUser,
} from "./repository.js";
import type { AsaasWebhookPayload, BillingStatus, BillingSubscription, BillingSubscriptionSummary } from "./types.js";

const PREMIUM_FEATURE_LABELS: Record<string, string> = {
  ai_chat: "Chat financeiro com IA",
  plans_ai: "Planejamento com IA",
  import_ai: "Sugestoes de importacao por IA",
  bulk_import: "Importacao em massa",
  bank_integrations: "Integracoes bancarias",
  insights_advanced: "Insights avancados",
};

const FREE_IMPORT_ROW_LIMIT = 50;

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeDateString(value: unknown) {
  const rawValue = asString(value);

  if (!rawValue) {
    return null;
  }

  const parsedDate = new Date(rawValue);

  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 10);
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? rawValue : null;
}

function normalizeTimestamp(value: unknown) {
  const rawValue = asString(value);

  if (!rawValue) {
    return new Date().toISOString();
  }

  const parsedDate = new Date(rawValue);
  return Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
}

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function buildCustomerData(user: Awaited<ReturnType<typeof findBillingUser>>) {
  if (!user) {
    return undefined;
  }

  const data: Record<string, unknown> = {
    name: user.name,
    email: user.email,
  };

  if (user.phone) {
    data.phone = user.phone.replace(/\D/g, "");
  }

  if (user.addressStreet) {
    data.address = user.addressStreet;
    data.addressNumber = user.addressNumber ?? "s/n";
    data.complement = user.addressComplement ?? undefined;
    data.province = user.addressNeighborhood ?? undefined;
    data.postalCode = user.addressPostalCode ?? undefined;
  }

  return data;
}

function mapProviderSubscriptionStatus(providerStatus: string | null, eventType?: string): BillingStatus {
  if (eventType === "SUBSCRIPTION_DELETED") {
    return "canceled";
  }

  if (eventType === "SUBSCRIPTION_INACTIVATED") {
    return "inactive";
  }

  switch ((providerStatus ?? "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "INACTIVE":
      return "inactive";
    case "EXPIRED":
      return "canceled";
    default:
      return "pending";
  }
}

function mapPaymentEventStatus(eventType: string): BillingStatus | null {
  switch (eventType) {
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED":
      return "active";
    case "PAYMENT_OVERDUE":
    case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED":
    case "PAYMENT_REFUNDED":
    case "PAYMENT_PARTIALLY_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
    case "PAYMENT_DELETED":
      return "past_due";
    default:
      return null;
  }
}

function mapCheckoutEventStatus(eventType: string): BillingStatus | null {
  switch (eventType) {
    case "CHECKOUT_PAID":
      return "active";
    case "CHECKOUT_CANCELED":
      return "canceled";
    case "CHECKOUT_EXPIRED":
      return "inactive";
    case "CHECKOUT_CREATED":
      return "pending";
    default:
      return null;
  }
}

function isEntitledStatus(status: BillingStatus) {
  return status === "active";
}

function formatBillingSummary(input: {
  plan: Awaited<ReturnType<typeof getPremiumPlan>> | null;
  customer: Awaited<ReturnType<typeof getBillingCustomerForUser>> | null;
  subscription: BillingSubscription | null;
}): BillingSubscriptionSummary {
  const status = input.subscription?.status ?? "inactive";

  return {
    isPremium: isEntitledStatus(status),
    status,
    plan: input.plan,
    customer: input.customer,
    subscription: input.subscription,
    nextDueDate: input.subscription?.nextDueDate ?? null,
    currentPeriodEnd: input.subscription?.currentPeriodEnd ?? null,
    checkoutUrl: input.subscription?.providerCheckoutUrl ?? null,
  };
}

async function notifyBillingStatusChange(userId: number, status: BillingStatus) {
  if (status !== "past_due" && status !== "canceled" && status !== "inactive") {
    return;
  }

  const user = await findBillingUser(userId);

  if (!user) {
    return;
  }

  try {
    if (status === "past_due") {
      await sendBillingPaymentFailedEmail({ to: user.email, name: user.name });
    } else {
      await sendBillingCanceledEmail({ to: user.email, name: user.name });
    }
  } catch (error) {
    logger.warn("Billing transactional email failed", {
      userId,
      status,
      error,
    });
  }
}

async function updateSubscriptionWithAudit(
  subscription: BillingSubscription,
  input: Parameters<typeof updateSubscriptionState>[1],
  action: string,
) {
  const updatedSubscription = await updateSubscriptionState(subscription.id, input);

  if (!updatedSubscription) {
    throw new HttpError(404, "subscription_not_found", "Subscription was not found.");
  }

  if (updatedSubscription.status !== subscription.status) {
    await insertBillingAuditLog({
      userId: updatedSubscription.userId,
      subscriptionId: updatedSubscription.id,
      action,
      previousStatus: subscription.status,
      nextStatus: updatedSubscription.status,
    });
    await refreshUserPremiumCache(updatedSubscription.userId);
    await notifyBillingStatusChange(updatedSubscription.userId, updatedSubscription.status);
  }

  return updatedSubscription;
}

export async function getBillingSubscription(userId: number) {
  const [plan, customer, subscription] = await Promise.all([
    getPremiumPlan(),
    getBillingCustomerForUser(userId),
    getLatestSubscriptionForUser(userId),
  ]);

  return formatBillingSummary({
    plan,
    customer,
    subscription,
  });
}

export async function createBillingCheckout(userId: number) {
  const user = await findBillingUser(userId);

  if (!user) {
    throw new BadRequestError("billing_user_not_found", "The authenticated user cannot be billed.");
  }

  const existingSubscription = await getLatestSubscriptionForUser(userId);

  if (existingSubscription?.status === "active") {
    return {
      checkoutUrl: existingSubscription.providerCheckoutUrl,
      subscription: await getBillingSubscription(userId),
    };
  }

  const plan = await getPremiumPlan();

  if (!plan) {
    throw new BadRequestError("billing_plan_not_configured", "Premium plan is not configured.");
  }

  const externalReference = `finly:user:${userId}:checkout:${randomUUID()}`;
  const customerData = buildCustomerData(user);
  const checkout = await createAsaasCheckout({
    billingTypes: ["CREDIT_CARD"],
    chargeTypes: ["RECURRENT"],
    minutesToExpire: 1440,
    externalReference,
    callback: {
      successUrl: env.billing.successUrl,
      cancelUrl: env.billing.cancelUrl,
      expiredUrl: env.billing.cancelUrl,
    },
    items: [
      {
        name: plan.name,
        description: plan.description ?? "Finly Premium",
        quantity: 1,
        value: plan.amount,
      },
    ],
    ...(customerData ? { customerData } : {}),
    subscription: {
      cycle: "MONTHLY",
      nextDueDate: tomorrowDate(),
    },
  });

  if (!checkout.id) {
    throw new HttpError(502, "asaas_checkout_id_missing", "Asaas did not return a checkout id.");
  }

  const checkoutUrl = buildAsaasCheckoutUrl(checkout.id);
  const customer = await upsertBillingCustomerForUser(user, null);
  const subscription = await createPendingSubscription({
    userId,
    customerId: customer.id,
    planId: plan.id,
    providerCheckoutId: checkout.id,
    providerCheckoutUrl: checkoutUrl,
    metadata: {
      externalReference,
      asaasPremiumPlanId: env.billing.asaasPremiumPlanId,
    },
  });

  await insertBillingAuditLog({
    userId,
    subscriptionId: subscription.id,
    action: "checkout_created",
    nextStatus: subscription.status,
    metadata: {
      providerCheckoutId: checkout.id,
    },
  });

  return {
    checkoutUrl,
    subscription: await getBillingSubscription(userId),
  };
}

export async function cancelBillingSubscription(userId: number) {
  const subscription = await getLatestSubscriptionForUser(userId);

  if (!subscription || subscription.status === "canceled" || subscription.status === "inactive") {
    return getBillingSubscription(userId);
  }

  if (subscription.providerSubscriptionId) {
    await deleteAsaasSubscription(subscription.providerSubscriptionId);
  } else if (subscription.providerCheckoutId) {
    await cancelAsaasCheckout(subscription.providerCheckoutId);
  }

  await updateSubscriptionWithAudit(
    subscription,
    {
      status: "canceled",
      canceledAt: new Date().toISOString(),
    },
    "subscription_canceled_by_user",
  );

  return getBillingSubscription(userId);
}

export async function syncBillingSubscription(userId: number) {
  const subscription = await getLatestSubscriptionForUser(userId);

  if (!subscription?.providerSubscriptionId) {
    await refreshUserPremiumCache(userId);
    return getBillingSubscription(userId);
  }

  const providerSubscription = await retrieveAsaasSubscription(subscription.providerSubscriptionId);
  const providerStatus = asString(providerSubscription.status);
  const status = mapProviderSubscriptionStatus(providerStatus);

  await updateSubscriptionWithAudit(
    subscription,
    {
      status,
      providerStatus,
      nextDueDate: normalizeDateString(providerSubscription.nextDueDate),
      currentPeriodEnd: normalizeDateString(providerSubscription.nextDueDate),
      activatedAt: status === "active" ? new Date().toISOString() : null,
      canceledAt: status === "canceled" || status === "inactive" ? new Date().toISOString() : null,
      metadata: {
        lastSyncAt: new Date().toISOString(),
      },
    },
    "subscription_synced",
  );

  return getBillingSubscription(userId);
}

async function resolveWebhookSubscription(payload: AsaasWebhookPayload) {
  const checkout = asRecord(payload.checkout);
  const providerSubscription = asRecord(payload.subscription);
  const payment = asRecord(payload.payment);
  const checkoutId = asString(checkout?.id);
  const providerSubscriptionId = asString(providerSubscription?.id) ?? asString(payment?.subscription);
  const providerCustomerId =
    asString(checkout?.customer) ?? asString(providerSubscription?.customer) ?? asString(payment?.customer);

  let subscription: BillingSubscription | null = null;

  if (checkoutId) {
    subscription = await findSubscriptionByCheckoutId(checkoutId);
  }

  if (!subscription && providerSubscriptionId) {
    subscription = await findSubscriptionByProviderSubscriptionId(providerSubscriptionId);
  }

  if (!subscription && providerCustomerId) {
    subscription = await findLatestSubscriptionByProviderCustomerId(providerCustomerId);
  }

  if (subscription && providerCustomerId && subscription.customerId) {
    await updateCustomerProviderId(subscription.customerId, providerCustomerId);
  } else if (providerCustomerId) {
    await findCustomerByProviderCustomerId(providerCustomerId);
  }

  return {
    checkout,
    payment,
    providerSubscription,
    checkoutId,
    providerSubscriptionId,
    providerCustomerId,
    providerPaymentId: asString(payment?.id),
    subscription,
  };
}

export async function processAsaasWebhook(payload: AsaasWebhookPayload) {
  const providerEventId = asString(payload.id);
  const eventType = asString(payload.event);

  if (!providerEventId || !eventType) {
    throw new BadRequestError("asaas_webhook_invalid", "Asaas webhook payload is missing id or event.");
  }

  const resolved = await resolveWebhookSubscription(payload);
  const eventInsert = await insertBillingEvent({
    providerEventId,
    eventType,
    userId: resolved.subscription?.userId ?? null,
    subscriptionId: resolved.subscription?.id ?? null,
    providerSubscriptionId: resolved.providerSubscriptionId,
    providerCheckoutId: resolved.checkoutId,
    providerPaymentId: resolved.providerPaymentId,
    status: resolved.subscription ? "processed" : "ignored",
    payload,
  });

  if (!eventInsert.inserted) {
    return { received: true, duplicate: true };
  }

  if (!resolved.subscription) {
    return { received: true, processed: false };
  }

  let nextStatus: BillingStatus | null = null;
  let nextDueDate: string | null = null;
  let currentPeriodEnd: string | null = null;
  let providerStatus: string | null = null;
  let activatedAt: string | null = null;
  let canceledAt: string | null = null;
  let lastPaymentAt: string | null = null;

  if (resolved.providerSubscription) {
    providerStatus = asString(resolved.providerSubscription.status);
    nextStatus = mapProviderSubscriptionStatus(providerStatus, eventType);
    nextDueDate = normalizeDateString(resolved.providerSubscription.nextDueDate);
    currentPeriodEnd = nextDueDate;
  } else if (resolved.payment) {
    nextStatus = mapPaymentEventStatus(eventType);
    nextDueDate = normalizeDateString(resolved.payment.dueDate);
    currentPeriodEnd = normalizeDateString(resolved.payment.dueDate);
    lastPaymentAt = normalizeTimestamp(
      resolved.payment.paymentDate ?? resolved.payment.clientPaymentDate ?? payload.dateCreated,
    );
  } else if (resolved.checkout) {
    nextStatus = mapCheckoutEventStatus(eventType);
    const checkoutSubscription = asRecord(resolved.checkout.subscription);
    nextDueDate = normalizeDateString(checkoutSubscription?.nextDueDate);
    currentPeriodEnd = normalizeDateString(checkoutSubscription?.nextDueDate);
  }

  if (!nextStatus) {
    return { received: true, processed: false };
  }

  if (nextStatus === "active") {
    activatedAt = new Date().toISOString();
  }

  if (nextStatus === "canceled" || nextStatus === "inactive") {
    canceledAt = new Date().toISOString();
  }

  await updateSubscriptionWithAudit(
    resolved.subscription,
    {
      status: nextStatus,
      providerStatus,
      providerSubscriptionId: resolved.providerSubscriptionId,
      nextDueDate,
      currentPeriodEnd,
      activatedAt,
      canceledAt,
      lastPaymentAt,
      metadata: {
        lastAsaasEvent: eventType,
        lastAsaasEventId: providerEventId,
      },
    },
    `asaas_${eventType.toLowerCase()}`,
  );

  return { received: true, processed: true };
}

export async function assertPremiumAccess(userId: number, feature: string) {
  const hasPremium = await hasActivePremiumSubscription(userId);

  if (!hasPremium) {
    throw new ForbiddenError(
      "premium_required",
      `${PREMIUM_FEATURE_LABELS[feature] ?? "Este recurso"} requer Premium.`,
    );
  }
}

export async function assertImportWithinFreeLimit(userId: number, items: unknown) {
  const rowCount = Array.isArray(items) ? items.length : 0;

  if (rowCount <= FREE_IMPORT_ROW_LIMIT) {
    return;
  }

  await assertPremiumAccess(userId, "bulk_import");
}

export { FREE_IMPORT_ROW_LIMIT };
