import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const rawEnvironment = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
    APP_ORIGIN: z.string().trim().optional(),
    PASSWORD_RESET_BASE_URL: z.string().trim().optional(),
    AUTH_REFRESH_COOKIE_NAME: z.string().trim().optional(),
    JWT_ACCESS_SECRET: z.string().trim().optional(),
    JWT_REFRESH_SECRET: z.string().trim().optional(),
    ASAAS_API_KEY: z.string().trim().optional(),
    ASAAS_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
    ASAAS_WEBHOOK_TOKEN: z.string().trim().optional(),
    ASAAS_PREMIUM_PLAN_ID: z.string().trim().optional(),
    APP_PUBLIC_URL: z.string().trim().optional(),
    BILLING_SUCCESS_URL: z.string().trim().optional(),
    BILLING_CANCEL_URL: z.string().trim().optional(),
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().trim().optional(),
    SMTP_PASSWORD: z.string().trim().optional(),
    SMTP_FROM: z.string().trim().optional(),
  })
  .parse(process.env);

const isProduction = rawEnvironment.NODE_ENV === "production";
const appOrigin = rawEnvironment.APP_ORIGIN || "http://localhost:5173";

function resolveSecret(value: string | undefined, fallback: string) {
  if (value) {
    return value;
  }

  if (isProduction) {
    throw new Error("JWT secrets must be configured in production.");
  }

  return fallback;
}

export const env = {
  nodeEnv: rawEnvironment.NODE_ENV,
  isProduction,
  isTest: rawEnvironment.NODE_ENV === "test",
  port: rawEnvironment.PORT,
  databaseUrl: rawEnvironment.DATABASE_URL,
  appOrigin,
  appPublicUrl: rawEnvironment.APP_PUBLIC_URL || appOrigin,
  billing: {
    asaasApiKey: rawEnvironment.ASAAS_API_KEY || null,
    asaasEnv: rawEnvironment.ASAAS_ENV,
    asaasWebhookToken: rawEnvironment.ASAAS_WEBHOOK_TOKEN || null,
    asaasPremiumPlanId: rawEnvironment.ASAAS_PREMIUM_PLAN_ID || null,
    successUrl: rawEnvironment.BILLING_SUCCESS_URL || `${rawEnvironment.APP_PUBLIC_URL || appOrigin}/profile`,
    cancelUrl: rawEnvironment.BILLING_CANCEL_URL || `${rawEnvironment.APP_PUBLIC_URL || appOrigin}/precos`,
  },
  email: {
    smtpHost: rawEnvironment.SMTP_HOST || null,
    smtpPort: rawEnvironment.SMTP_PORT || null,
    smtpUser: rawEnvironment.SMTP_USER || null,
    smtpPassword: rawEnvironment.SMTP_PASSWORD || null,
    smtpFrom: rawEnvironment.SMTP_FROM || null,
  },
  auth: {
    accessTokenSecret: resolveSecret(rawEnvironment.JWT_ACCESS_SECRET, "finance-dev-access-secret"),
    refreshTokenSecret: resolveSecret(rawEnvironment.JWT_REFRESH_SECRET, "finance-dev-refresh-secret"),
    accessTokenTtlMs: 15 * 60 * 1000,
    sessionRefreshTtlMs: 24 * 60 * 60 * 1000,
    rememberedRefreshTtlMs: 30 * 24 * 60 * 60 * 1000,
    resetTokenTtlMs: 15 * 60 * 1000,
    refreshCookieName: rawEnvironment.AUTH_REFRESH_COOKIE_NAME || "finance_rt",
    passwordResetBaseUrl: rawEnvironment.PASSWORD_RESET_BASE_URL || `${appOrigin}/reset-password`,
  },
} as const;
