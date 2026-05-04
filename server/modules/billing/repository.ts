import type { Pool, PoolClient } from "pg";

import { db } from "../../shared/db.js";
import type { BillingCustomer, BillingPlan, BillingStatus, BillingSubscription } from "./types.js";

type Queryable = Pick<Pool, "query"> | PoolClient;

export type BillingUserRecord = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
};

function parseNumeric(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseJsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function mapPlan(row: Record<string, unknown>): BillingPlan {
  return {
    id: String(row.id),
    provider: String(row.provider),
    providerPlanId: row.provider_plan_id ? String(row.provider_plan_id) : null,
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    amount: parseNumeric(row.amount),
    currency: String(row.currency ?? "BRL"),
    intervalUnit: row.interval_unit === "year" ? "year" : "month",
    intervalCount: Number(row.interval_count ?? 1),
    features: parseJsonArray(row.features),
    active: Boolean(row.active),
  };
}

function mapCustomer(row: Record<string, unknown>): BillingCustomer {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    provider: String(row.provider),
    providerCustomerId: row.provider_customer_id ? String(row.provider_customer_id) : null,
    name: row.name ? String(row.name) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
  };
}

function normalizeStatus(value: unknown): BillingStatus {
  switch (value) {
    case "active":
    case "past_due":
    case "canceled":
    case "inactive":
    case "pending":
      return value;
    default:
      return "pending";
  }
}

function mapSubscription(row: Record<string, unknown>): BillingSubscription {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    customerId: row.customer_id === null || row.customer_id === undefined ? null : Number(row.customer_id),
    planId: String(row.plan_id),
    provider: String(row.provider),
    providerSubscriptionId: row.provider_subscription_id ? String(row.provider_subscription_id) : null,
    providerCheckoutId: row.provider_checkout_id ? String(row.provider_checkout_id) : null,
    providerCheckoutUrl: row.provider_checkout_url ? String(row.provider_checkout_url) : null,
    status: normalizeStatus(row.status),
    providerStatus: row.provider_status ? String(row.provider_status) : null,
    currentPeriodStart: row.current_period_start ? String(row.current_period_start).slice(0, 10) : null,
    currentPeriodEnd: row.current_period_end ? String(row.current_period_end).slice(0, 10) : null,
    nextDueDate: row.next_due_date ? String(row.next_due_date).slice(0, 10) : null,
    activatedAt: row.activated_at ? new Date(String(row.activated_at)).toISOString() : null,
    canceledAt: row.canceled_at ? new Date(String(row.canceled_at)).toISOString() : null,
    lastPaymentAt: row.last_payment_at ? new Date(String(row.last_payment_at)).toISOString() : null,
    metadata: parseJsonObject(row.metadata),
  };
}

export async function withBillingTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findBillingUser(userId: number, client: Queryable = db): Promise<BillingUserRecord | null> {
  const result = await client.query(
    `
      SELECT
        id,
        name,
        email,
        phone,
        address_street,
        address_number,
        address_complement,
        address_neighborhood,
        address_city,
        address_state,
        address_postal_code,
        address_country
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );

  const row = result.rows[0];

  if (!row?.email) {
    return null;
  }

  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: row.phone ? String(row.phone) : null,
    addressStreet: row.address_street ? String(row.address_street) : null,
    addressNumber: row.address_number ? String(row.address_number) : null,
    addressComplement: row.address_complement ? String(row.address_complement) : null,
    addressNeighborhood: row.address_neighborhood ? String(row.address_neighborhood) : null,
    addressCity: row.address_city ? String(row.address_city) : null,
    addressState: row.address_state ? String(row.address_state) : null,
    addressPostalCode: row.address_postal_code ? String(row.address_postal_code) : null,
    addressCountry: row.address_country ? String(row.address_country) : null,
  };
}

export async function getPremiumPlan(client: Queryable = db) {
  const result = await client.query(
    `
      SELECT *
      FROM billing_plans
      WHERE id = 'premium_monthly'
        AND active = TRUE
      LIMIT 1
    `,
  );

  return result.rows[0] ? mapPlan(result.rows[0]) : null;
}

export async function upsertBillingCustomerForUser(
  user: BillingUserRecord,
  providerCustomerId: string | null,
  client: Queryable = db,
) {
  const result = await client.query(
    `
      INSERT INTO billing_customers (
        user_id,
        provider,
        provider_customer_id,
        name,
        email,
        phone,
        updated_at
      )
      VALUES ($1, 'asaas', $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id, provider)
      DO UPDATE SET
        provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, billing_customers.provider_customer_id),
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        updated_at = NOW()
      RETURNING *
    `,
    [user.id, providerCustomerId, user.name, user.email, user.phone],
  );

  return mapCustomer(result.rows[0]);
}

export async function updateCustomerProviderId(customerId: number, providerCustomerId: string, client: Queryable = db) {
  const result = await client.query(
    `
      UPDATE billing_customers
      SET provider_customer_id = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [customerId, providerCustomerId],
  );

  return result.rows[0] ? mapCustomer(result.rows[0]) : null;
}

export async function findCustomerByProviderCustomerId(providerCustomerId: string, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT *
      FROM billing_customers
      WHERE provider = 'asaas'
        AND provider_customer_id = $1
      LIMIT 1
    `,
    [providerCustomerId],
  );

  return result.rows[0] ? mapCustomer(result.rows[0]) : null;
}

export async function getBillingCustomerForUser(userId: number, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT *
      FROM billing_customers
      WHERE user_id = $1
        AND provider = 'asaas'
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ? mapCustomer(result.rows[0]) : null;
}

export async function createPendingSubscription(
  input: {
    userId: number;
    customerId: number;
    planId: string;
    providerCheckoutId: string;
    providerCheckoutUrl: string;
    metadata?: Record<string, unknown>;
  },
  client: Queryable = db,
) {
  const result = await client.query(
    `
      INSERT INTO billing_subscriptions (
        user_id,
        customer_id,
        plan_id,
        provider,
        provider_checkout_id,
        provider_checkout_url,
        status,
        metadata,
        updated_at
      )
      VALUES ($1, $2, $3, 'asaas', $4, $5, 'pending', $6::jsonb, NOW())
      RETURNING *
    `,
    [
      input.userId,
      input.customerId,
      input.planId,
      input.providerCheckoutId,
      input.providerCheckoutUrl,
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  return mapSubscription(result.rows[0]);
}

export async function getLatestSubscriptionForUser(userId: number, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT *
      FROM billing_subscriptions
      WHERE user_id = $1
      ORDER BY
        CASE status
          WHEN 'active' THEN 1
          WHEN 'past_due' THEN 2
          WHEN 'pending' THEN 3
          WHEN 'inactive' THEN 4
          WHEN 'canceled' THEN 5
          ELSE 6
        END,
        updated_at DESC
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ? mapSubscription(result.rows[0]) : null;
}

export async function findSubscriptionByCheckoutId(checkoutId: string, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT *
      FROM billing_subscriptions
      WHERE provider = 'asaas'
        AND provider_checkout_id = $1
      LIMIT 1
    `,
    [checkoutId],
  );

  return result.rows[0] ? mapSubscription(result.rows[0]) : null;
}

export async function findSubscriptionByProviderSubscriptionId(subscriptionId: string, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT *
      FROM billing_subscriptions
      WHERE provider = 'asaas'
        AND provider_subscription_id = $1
      LIMIT 1
    `,
    [subscriptionId],
  );

  return result.rows[0] ? mapSubscription(result.rows[0]) : null;
}

export async function findLatestSubscriptionByProviderCustomerId(providerCustomerId: string, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT s.*
      FROM billing_subscriptions s
      INNER JOIN billing_customers c ON c.id = s.customer_id
      WHERE c.provider = 'asaas'
        AND c.provider_customer_id = $1
      ORDER BY s.updated_at DESC
      LIMIT 1
    `,
    [providerCustomerId],
  );

  return result.rows[0] ? mapSubscription(result.rows[0]) : null;
}

export async function updateSubscriptionState(
  subscriptionId: number,
  input: {
    status?: BillingStatus;
    providerStatus?: string | null;
    providerSubscriptionId?: string | null;
    nextDueDate?: string | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    activatedAt?: string | null;
    canceledAt?: string | null;
    lastPaymentAt?: string | null;
    metadata?: Record<string, unknown>;
  },
  client: Queryable = db,
) {
  const result = await client.query(
    `
      UPDATE billing_subscriptions
      SET status = COALESCE($2, status),
          provider_status = COALESCE($3, provider_status),
          provider_subscription_id = COALESCE($4, provider_subscription_id),
          next_due_date = COALESCE($5::date, next_due_date),
          current_period_start = COALESCE($6::date, current_period_start),
          current_period_end = COALESCE($7::date, current_period_end),
          activated_at = COALESCE($8::timestamptz, activated_at),
          canceled_at = COALESCE($9::timestamptz, canceled_at),
          last_payment_at = COALESCE($10::timestamptz, last_payment_at),
          metadata = metadata || COALESCE($11::jsonb, '{}'::jsonb),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      subscriptionId,
      input.status ?? null,
      input.providerStatus ?? null,
      input.providerSubscriptionId ?? null,
      input.nextDueDate ?? null,
      input.currentPeriodStart ?? null,
      input.currentPeriodEnd ?? null,
      input.activatedAt ?? null,
      input.canceledAt ?? null,
      input.lastPaymentAt ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );

  return result.rows[0] ? mapSubscription(result.rows[0]) : null;
}

export async function insertBillingEvent(
  input: {
    providerEventId: string;
    eventType: string;
    userId?: number | null;
    subscriptionId?: number | null;
    providerSubscriptionId?: string | null;
    providerCheckoutId?: string | null;
    providerPaymentId?: string | null;
    status?: "processed" | "ignored" | "failed";
    errorMessage?: string | null;
    payload: Record<string, unknown>;
  },
  client: Queryable = db,
) {
  const result = await client.query(
    `
      INSERT INTO billing_events (
        provider,
        provider_event_id,
        event_type,
        user_id,
        subscription_id,
        provider_subscription_id,
        provider_checkout_id,
        provider_payment_id,
        status,
        error_message,
        payload
      )
      VALUES ('asaas', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (provider, provider_event_id) DO NOTHING
      RETURNING id
    `,
    [
      input.providerEventId,
      input.eventType,
      input.userId ?? null,
      input.subscriptionId ?? null,
      input.providerSubscriptionId ?? null,
      input.providerCheckoutId ?? null,
      input.providerPaymentId ?? null,
      input.status ?? "processed",
      input.errorMessage ?? null,
      JSON.stringify(input.payload),
    ],
  );

  return { inserted: Boolean(result.rows[0]?.id) };
}

export async function insertBillingAuditLog(
  input: {
    userId?: number | null;
    subscriptionId?: number | null;
    action: string;
    previousStatus?: string | null;
    nextStatus?: string | null;
    metadata?: Record<string, unknown>;
  },
  client: Queryable = db,
) {
  await client.query(
    `
      INSERT INTO billing_audit_logs (
        user_id,
        subscription_id,
        action,
        previous_status,
        next_status,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      input.userId ?? null,
      input.subscriptionId ?? null,
      input.action,
      input.previousStatus ?? null,
      input.nextStatus ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function refreshUserPremiumCache(userId: number, client: Queryable = db) {
  await client.query(
    `
      WITH active_subscription AS (
        SELECT activated_at
        FROM billing_subscriptions
        WHERE user_id = $1
          AND status = 'active'
        ORDER BY activated_at ASC NULLS LAST, updated_at ASC
        LIMIT 1
      )
      UPDATE users
      SET is_premium = EXISTS(SELECT 1 FROM active_subscription),
          premium_since = CASE
            WHEN EXISTS(SELECT 1 FROM active_subscription)
              THEN COALESCE((SELECT activated_at FROM active_subscription), premium_since, NOW())
            ELSE NULL
          END,
          updated_at = NOW()
      WHERE id = $1
    `,
    [userId],
  );
}

export async function hasActivePremiumSubscription(userId: number, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT EXISTS(
        SELECT 1
        FROM billing_subscriptions
        WHERE user_id = $1
          AND status = 'active'
      ) AS has_premium
    `,
    [userId],
  );

  return Boolean(result.rows[0]?.has_premium);
}
