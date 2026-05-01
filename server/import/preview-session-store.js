const DEFAULT_TTL_MS = 15 * 60 * 1000;

const previewMetadataStore = new Map();

function cleanupExpiredEntries() {
  const now = Date.now();

  for (const [previewToken, entry] of previewMetadataStore.entries()) {
    if (entry.expiresAtMs <= now) {
      previewMetadataStore.delete(previewToken);
    }
  }
}

export function setUniversalPreviewMetadata(previewToken, metadata, ttlMs = DEFAULT_TTL_MS) {
  cleanupExpiredEntries();
  previewMetadataStore.set(String(previewToken), {
    metadata,
    expiresAtMs: Date.now() + ttlMs,
  });
}

export function getUniversalPreviewMetadata(previewToken) {
  cleanupExpiredEntries();
  return previewMetadataStore.get(String(previewToken))?.metadata ?? null;
}
