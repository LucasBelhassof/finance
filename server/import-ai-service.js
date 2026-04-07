import { requestDirectImportAiSuggestions } from "./import-ai-provider-direct.js";
import { requestWebhookImportAiSuggestions } from "./import-ai-provider-webhook.js";

function parseBooleanFlag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "true";
}

function parseNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getImportAiConfig() {
  return {
    enabled: parseBooleanFlag(process.env.IMPORT_AI_ENABLED),
    mode: process.env.IMPORT_AI_MODE?.trim() === "webhook" ? "webhook" : "direct",
    autoApplyThreshold: Math.max(0, Math.min(1, parseNumber(process.env.IMPORT_AI_AUTO_APPLY_THRESHOLD, 0.8))),
    maxRowsPerRequest: Math.max(1, Math.floor(parseNumber(process.env.IMPORT_AI_MAX_ROWS_PER_REQUEST, 100))),
  };
}

export async function suggestImportCategories(payload) {
  const config = getImportAiConfig();

  if (!config.enabled) {
    return {
      status: "disabled",
      items: [],
      autoApplyThreshold: config.autoApplyThreshold,
      maxRowsPerRequest: config.maxRowsPerRequest,
    };
  }

  const items =
    config.mode === "webhook"
      ? await requestWebhookImportAiSuggestions(payload)
      : await requestDirectImportAiSuggestions(payload);

  return {
    status: "completed",
    items,
    autoApplyThreshold: config.autoApplyThreshold,
    maxRowsPerRequest: config.maxRowsPerRequest,
  };
}
