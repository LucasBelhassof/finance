import { env } from "../../shared/env.js";
import { BadRequestError, HttpError } from "../../shared/errors.js";

type AsaasCheckoutInput = {
  billingTypes: string[];
  chargeTypes: string[];
  minutesToExpire: number;
  externalReference: string;
  callback: {
    successUrl: string;
    cancelUrl: string;
    expiredUrl: string;
  };
  items: Array<{
    name: string;
    description: string;
    quantity: number;
    value: number;
  }>;
  customerData?: Record<string, unknown>;
  subscription: {
    cycle: string;
    nextDueDate: string;
  };
};

function getBaseUrl() {
  return env.billing.asaasEnv === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

export function buildAsaasCheckoutUrl(checkoutId: string) {
  const baseUrl = env.billing.asaasEnv === "production" ? "https://www.asaas.com" : "https://sandbox.asaas.com";
  return `${baseUrl}/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`;
}

function assertAsaasConfigured() {
  if (!env.billing.asaasApiKey) {
    throw new BadRequestError("billing_provider_not_configured", "Asaas billing credentials are not configured.");
  }
}

async function parseAsaasResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

async function asaasRequest<T>(path: string, init: RequestInit = {}) {
  assertAsaasConfigured();

  const headers = new Headers(init.headers);
  headers.set("access_token", env.billing.asaasApiKey!);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers,
  });
  const body = await parseAsaasResponse(response);

  if (!response.ok) {
    const message =
      typeof body.message === "string"
        ? body.message
        : Array.isArray(body.errors)
          ? body.errors
              .map((item) =>
                item && typeof item === "object" && typeof (item as { description?: unknown }).description === "string"
                  ? (item as { description: string }).description
                  : null,
              )
              .filter(Boolean)
              .join(" ")
          : "Asaas request failed.";

    throw new HttpError(response.status, "asaas_request_failed", message || "Asaas request failed.", body);
  }

  return body as T;
}

export async function createAsaasCheckout(input: AsaasCheckoutInput) {
  return asaasRequest<{ id?: string }>("/checkouts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelAsaasCheckout(checkoutId: string) {
  return asaasRequest<Record<string, unknown>>(`/checkouts/${encodeURIComponent(checkoutId)}/cancel`, {
    method: "POST",
  });
}

export async function deleteAsaasSubscription(subscriptionId: string) {
  return asaasRequest<Record<string, unknown>>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
  });
}

export async function retrieveAsaasSubscription(subscriptionId: string) {
  return asaasRequest<Record<string, unknown>>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}
