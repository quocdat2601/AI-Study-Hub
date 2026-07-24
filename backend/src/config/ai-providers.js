const createError = require('../utils/createError');

function parseList(value, fallback) {
  return String(value || fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const defaultProvider = process.env.AI_PROVIDER || 'gemini';

const gemini = {
  provider: 'gemini',
  defaultModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  allowedModels: parseList(
    process.env.GEMINI_ALLOWED_MODELS,
    'gemini-3.6-flash,gemini-3.5-flash'
  ),
};

const ollama = {
  provider: 'ollama',
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  defaultModel: process.env.OLLAMA_MODEL || 'qwen2.5:3b',
  allowedModels: parseList(
    process.env.OLLAMA_ALLOWED_MODELS,
    'qwen2.5:3b'
  ),
};

function getDefaultModel() {
  return defaultProvider === 'ollama' ? ollama.defaultModel : gemini.defaultModel;
}

function resolveModel(selectedModel) {
  const model = String(selectedModel || getDefaultModel()).trim();

  if (gemini.allowedModels.includes(model) || model.startsWith('gemini-')) {
    if (!gemini.allowedModels.includes(model)) {
      throw createError(400, 'Selected Gemini model is not allowed');
    }
    return { provider: 'gemini', model };
  }

  if (ollama.allowedModels.includes(model) || model.startsWith('qwen')) {
    if (!ollama.allowedModels.includes(model)) {
      throw createError(400, 'Selected local model is not allowed');
    }
    return { provider: 'ollama', model };
  }

  throw createError(400, 'Selected AI model is not allowed');
}

module.exports = {
  defaultProvider,
  gemini,
  ollama,
  getDefaultModel,
  resolveModel,
};
