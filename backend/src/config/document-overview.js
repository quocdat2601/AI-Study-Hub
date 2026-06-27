const aiProviders = require('./ai-providers');
const createError = require('../utils/createError');

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseInteger(value, fallback, { min, max }) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  if (!provider) return aiProviders.defaultProvider || 'gemini';
  if (provider === 'gemini' || provider === 'ollama') return provider;
  throw createError(400, 'Document overview provider must be gemini or ollama');
}

function resolveOverviewProviderModel() {
  const rawProvider = String(process.env.DOCUMENT_OVERVIEW_PROVIDER || '').trim();
  const rawModel = String(process.env.DOCUMENT_OVERVIEW_MODEL || '').trim();

  if (!rawProvider && rawModel) {
    return aiProviders.resolveModel(rawModel);
  }

  const provider = normalizeProvider(rawProvider);
  const model = rawModel
    || (provider === 'ollama' ? aiProviders.ollama.defaultModel : aiProviders.gemini.defaultModel);

  if (provider === 'ollama') {
    if (!aiProviders.ollama.allowedModels.includes(model)) {
      throw createError(400, 'Selected document overview Ollama model is not allowed');
    }
    return { provider, model };
  }

  if (!aiProviders.gemini.allowedModels.includes(model)) {
    throw createError(400, 'Selected document overview Gemini model is not allowed');
  }
  return { provider, model };
}

function getDocumentOverviewConfig() {
  const providerModel = resolveOverviewProviderModel();
  return {
    enabled: parseBoolean(process.env.DOCUMENT_OVERVIEW_ENABLED, true),
    ...providerModel,
    maxChars: parseInteger(process.env.DOCUMENT_OVERVIEW_MAX_CHARS, 12000, {
      min: 1000,
      max: 50000,
    }),
    maxChunks: parseInteger(process.env.DOCUMENT_OVERVIEW_MAX_CHUNKS, 8, {
      min: 2,
      max: 20,
    }),
    overviewVersion: 'v1',
    pendingTimeoutMs: 10 * 60 * 1000,
  };
}

module.exports = {
  getDocumentOverviewConfig,
  resolveOverviewProviderModel,
};
