const DEFAULT_TTL_MS = 50 * 60 * 1000;
const signedUrlCache = new Map();
const previewDataCache = new Map();
const MAX_PREVIEW_ENTRIES = 3;

function now() {
  return Date.now();
}

export function getCachedSignedPayload(key) {
  const entry = signedUrlCache.get(key);
  if (!entry || entry.expiresAt <= now()) {
    signedUrlCache.delete(key);
    return null;
  }
  return entry.payload;
}

export function setCachedSignedPayload(key, payload, ttlMs = DEFAULT_TTL_MS) {
  signedUrlCache.set(key, {
    payload,
    expiresAt: now() + ttlMs,
  });
  return payload;
}

export function getCachedPreviewData(key) {
  const entry = previewDataCache.get(key);
  if (!entry) return null;
  previewDataCache.delete(key);
  previewDataCache.set(key, entry);
  return entry;
}

export function setCachedPreviewData(key, value) {
  if (previewDataCache.has(key)) {
    previewDataCache.delete(key);
  }
  previewDataCache.set(key, value);
  while (previewDataCache.size > MAX_PREVIEW_ENTRIES) {
    const oldestKey = previewDataCache.keys().next().value;
    previewDataCache.delete(oldestKey);
  }
  return value;
}
