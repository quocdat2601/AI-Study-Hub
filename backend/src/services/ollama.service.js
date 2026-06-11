const aiProviders = require('../config/ai-providers');
const createError = require('../utils/createError');

const OLLAMA_TIMEOUT_MS = 30000;

function withTimeout(promise, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    promise: promise(controller.signal).finally(() => clearTimeout(timeoutId)),
  };
}

function createUnavailableError() {
  return createError(503, 'Local AI model is not available. Please start Ollama and try again.');
}

function createModelMissingError(model) {
  return createError(400, `Selected local model is not installed. Run ollama pull ${model} first.`);
}

async function fetchJson(path, options = {}) {
  const url = `${aiProviders.ollama.baseUrl}${path}`;
  const request = (signal) => fetch(url, { ...options, signal });
  const { promise } = withTimeout(request, OLLAMA_TIMEOUT_MS);

  try {
    const response = await promise;
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err = new Error(text || `Ollama request failed with ${response.status}`);
      err.statusCode = response.status;
      throw err;
    }
    return response.json();
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
      throw createUnavailableError();
    }
    throw err;
  }
}

async function getInstalledModels() {
  const data = await fetchJson('/api/tags');
  return (data.models || []).map((model) => model.name).filter(Boolean);
}

async function getStatus() {
  try {
    const installedModels = await getInstalledModels();
    return {
      available: true,
      baseUrl: aiProviders.ollama.baseUrl,
      models: installedModels,
      allowedModels: aiProviders.ollama.allowedModels,
      defaultModel: aiProviders.ollama.defaultModel,
    };
  } catch {
    return {
      available: false,
      baseUrl: aiProviders.ollama.baseUrl,
      models: [],
      allowedModels: aiProviders.ollama.allowedModels,
      defaultModel: aiProviders.ollama.defaultModel,
    };
  }
}

async function assertModelInstalled(model) {
  const installedModels = await getInstalledModels();
  if (!installedModels.includes(model)) {
    throw createModelMissingError(model);
  }
}

async function generateChat({ model, systemPrompt, userPrompt, messages }) {
  await assertModelInstalled(model);

  const payloadMessages = messages || [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const data = await fetchJson('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: payloadMessages,
      stream: false,
    }),
  });

  return {
    text: data.message?.content || '',
    usageMetadata: {
      promptTokens: Number(data.prompt_eval_count || 0),
      completionTokens: Number(data.eval_count || 0),
      totalTokens: Number(data.prompt_eval_count || 0) + Number(data.eval_count || 0),
    },
    model,
  };
}

module.exports = {
  generateChat,
  getStatus,
};
