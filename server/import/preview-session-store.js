const DEFAULT_TTL_MS = 15 * 60 * 1000;

const previewStore = new Map();

function cleanupExpiredEntries() {
  const now = Date.now();

  for (const [previewToken, entry] of previewStore.entries()) {
    if (entry.expiresAtMs <= now) {
      previewStore.delete(previewToken);
    }
  }
}

export function setUniversalPreviewMetadata(previewToken, metadata, ttlMs = DEFAULT_TTL_MS) {
  cleanupExpiredEntries();
  const key = String(previewToken);
  const currentEntry = previewStore.get(key);

  previewStore.set(key, {
    metadata,
    session: currentEntry?.session ?? null,
    expiresAtMs: Date.now() + ttlMs,
  });
}

export function setUniversalPreviewSession(previewToken, session, ttlMs = DEFAULT_TTL_MS) {
  cleanupExpiredEntries();
  const key = String(previewToken);
  const currentEntry = previewStore.get(key);
  const expiresAtMs =
    Number.isInteger(Number(session?.expiresAtMs)) && Number(session.expiresAtMs) > Date.now()
      ? Number(session.expiresAtMs)
      : Date.now() + ttlMs;

  previewStore.set(key, {
    metadata: currentEntry?.metadata ?? null,
    session,
    expiresAtMs,
  });
}

export function getUniversalPreviewMetadata(previewToken) {
  cleanupExpiredEntries();
  return previewStore.get(String(previewToken))?.metadata ?? null;
}

export function hasUniversalPreviewSession(previewToken) {
  cleanupExpiredEntries();
  return previewStore.get(String(previewToken))?.session != null;
}

export function getUniversalPreviewSession(previewToken, userId) {
  cleanupExpiredEntries();
  const key = String(previewToken);
  const session = previewStore.get(key)?.session ?? null;

  if (!session || session.userId !== String(userId)) {
    throw new Error("Preview invalido ou expirado.");
  }

  if (session.expiresAtMs <= Date.now()) {
    previewStore.delete(key);
    throw new Error("A previa expirou. Gere a previa novamente para continuar.");
  }

  return session;
}
