export type BillingStatus = "active" | "past_due" | "canceled" | "inactive" | "pending";

export type PremiumFeature =
  | "ai_chat"
  | "plans_ai"
  | "import_ai"
  | "bulk_import"
  | "bank_integrations"
  | "insights_advanced";

export interface BillingPlan {
  id: string;
  provider: "asaas" | string;
  providerPlanId: string | null;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  intervalUnit: "month" | "year";
  intervalCount: number;
  features: string[];
  active: boolean;
}

export interface BillingCustomer {
  id: number;
  userId: number;
  provider: "asaas" | string;
  providerCustomerId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface BillingSubscription {
  id: number;
  userId: number;
  customerId: number | null;
  planId: string;
  provider: "asaas" | string;
  providerSubscriptionId: string | null;
  providerCheckoutId: string | null;
  providerCheckoutUrl: string | null;
  status: BillingStatus;
  providerStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextDueDate: string | null;
  activatedAt: string | null;
  canceledAt: string | null;
  lastPaymentAt: string | null;
  metadata: Record<string, unknown>;
}

export interface BillingSubscriptionSummary {
  isPremium: boolean;
  status: BillingStatus;
  plan: BillingPlan | null;
  customer: BillingCustomer | null;
  subscription: BillingSubscription | null;
  nextDueDate: string | null;
  currentPeriodEnd: string | null;
  checkoutUrl: string | null;
}

export type AsaasWebhookPayload = {
  id?: unknown;
  event?: unknown;
  dateCreated?: unknown;
  checkout?: Record<string, unknown>;
  subscription?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  [key: string]: unknown;
};
