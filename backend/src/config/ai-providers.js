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
  defaultModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  allowedModels: parseList(
    process.env.GEMINI_ALLOWED_MODELS,
    'gemini-2.5-flash,gemini-2.5-flash-lite,gemini-3.1-flash-lite,gemini-3-flash,gemini-3.5-flash'
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

const openai = {
  provider: 'openai',
  allowedModels: ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'gpt-3.5-turbo'],
};

const anthropic = {
  provider: 'anthropic',
  allowedModels: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
};

const grok = {
  provider: 'grok',
  allowedModels: ['grok-beta', 'grok-2', 'grok-2-mini'],
};

const groq = {
  provider: 'groq',
  allowedModels: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ],
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

  if (openai.allowedModels.includes(model)) {
    return { provider: 'openai', model };
  }

  if (anthropic.allowedModels.includes(model)) {
    return { provider: 'anthropic', model };
  }

  if (grok.allowedModels.includes(model)) {
    return { provider: 'grok', model };
  }

  if (groq.allowedModels.includes(model)) {
    return { provider: 'groq', model };
  }

  throw createError(400, 'Selected AI model is not allowed');
}

module.exports = {
  defaultProvider,
  gemini,
  ollama,
  openai,
  anthropic,
  grok,
  groq,
  getDefaultModel,
  resolveModel,
};
