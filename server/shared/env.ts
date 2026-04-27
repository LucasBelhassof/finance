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
    // Pluggy Open Finance (premium feature)
    PLUGGY_CLIENT_ID: z.string().trim().optional(),
    PLUGGY_CLIENT_SECRET: z.string().trim().optional(),
    PLUGGY_ENCRYPTION_KEY: z.string().trim().optional(),
    API_BASE_URL: z.string().trim().optional(),
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
  pluggy: {
    clientId: rawEnvironment.PLUGGY_CLIENT_ID || "",
    clientSecret: rawEnvironment.PLUGGY_CLIENT_SECRET || "",
    encryptionKey: rawEnvironment.PLUGGY_ENCRYPTION_KEY || "",
    apiBaseUrl: rawEnvironment.API_BASE_URL || appOrigin,
  },
} as const;
