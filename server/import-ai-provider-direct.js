function getDirectProviderConfig() {
  return {
    url: process.env.IMPORT_AI_DIRECT_URL?.trim(),
    apiKey: process.env.IMPORT_AI_API_KEY?.trim(),
    timeoutMs: Number.parseInt(process.env.IMPORT_AI_TIMEOUT_MS ?? "8000", 10),
  };
}

export async function requestDirectImportAiSuggestions(payload) {
  const config = getDirectProviderConfig();

  if (!config.url) {
    throw new Error("IMPORT_AI_DIRECT_URL is required when IMPORT_AI_MODE=direct.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(config.timeoutMs) ? config.timeoutMs : 8000);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        task: "transaction_import_categorization",
        ...payload,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(body?.message ?? "O provedor direto de IA falhou.");
    }

    return Array.isArray(body?.items) ? body.items : [];
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("A sugestao por IA expirou antes da resposta.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
