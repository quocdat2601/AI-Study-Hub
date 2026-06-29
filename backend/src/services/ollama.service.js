const aiProviders = require('../config/ai-providers');
const createError = require('../utils/createError');

const OLLAMA_STATUS_TIMEOUT_MS = 15000;
const OLLAMA_CHAT_TIMEOUT_MS = Number(process.env.OLLAMA_CHAT_TIMEOUT_MS) || 180000;

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

function createTimeoutError() {
  const err = createError(504, 'Local AI model request timed out. Please try again.');
  err.publicMessage = 'Ollama phản hồi quá chậm (quá thời gian chờ). Hãy thử lại hoặc chọn mô hình Gemini.';
  return err;
}

function createModelMissingError(model) {
  return createError(400, `Selected local model is not installed. Run ollama pull ${model} first.`);
}

async function fetchJson(path, options = {}, timeoutMs = OLLAMA_STATUS_TIMEOUT_MS) {
  const url = `${aiProviders.ollama.baseUrl}${path}`;
  const request = (signal) => fetch(url, { ...options, signal });
  const { promise } = withTimeout(request, timeoutMs);

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
    if (err.name === 'AbortError') {
      throw timeoutMs >= OLLAMA_CHAT_TIMEOUT_MS ? createTimeoutError() : createUnavailableError();
    }
    if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
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

async function generateChat({ model, systemPrompt, userPrompt, messages, format, options }) {
  await assertModelInstalled(model);

  const payloadMessages = messages || [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  if (process.env.NODE_ENV !== 'production' && String(systemPrompt || '').includes('OCR-extracted text')) {
    console.info('[image-ocr-debug] ollama-payload', {
      model,
      stream: false,
      roles: payloadMessages.map((message) => message.role),
      hasOcrSystemInstruction: true,
      hasOcrUserContext: payloadMessages.some((message) => String(message.content || '').includes('Retrieved OCR text chunks')),
    });
  }

  const data = await fetchJson('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: payloadMessages,
      stream: false,
      ...(format ? { format } : {}),
      ...(options ? { options } : {}),
    }),
  }, OLLAMA_CHAT_TIMEOUT_MS);

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

async function* streamChat({ model, systemPrompt, userPrompt, messages }) {
  await assertModelInstalled(model);

  const payloadMessages = messages || [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  if (process.env.NODE_ENV !== 'production' && String(systemPrompt || '').includes('OCR-extracted text')) {
    console.info('[image-ocr-debug] ollama-payload', {
      model,
      stream: true,
      roles: payloadMessages.map((message) => message.role),
      hasOcrSystemInstruction: true,
      hasOcrUserContext: payloadMessages.some((message) => String(message.content || '').includes('Retrieved OCR text chunks')),
    });
  }

  const url = `${aiProviders.ollama.baseUrl}/api/chat`;
  const request = (signal) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: payloadMessages,
      stream: true,
    }),
    signal,
  });
  const { promise } = withTimeout(request, OLLAMA_CHAT_TIMEOUT_MS);

  let response;
  try {
    response = await promise;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw createTimeoutError();
    }
    if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
      throw createUnavailableError();
    }
    throw err;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(text || `Ollama request failed with ${response.status}`);
    err.statusCode = response.status;
    throw err;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const reader = response.body.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const data = JSON.parse(trimmed);
      const text = data.message?.content || '';
      if (text) {
        yield { type: 'token', text };
      }
      if (data.done) {
        yield {
          type: 'usage',
          usageMetadata: {
            promptTokens: Number(data.prompt_eval_count || 0),
            completionTokens: Number(data.eval_count || 0),
            totalTokens: Number(data.prompt_eval_count || 0) + Number(data.eval_count || 0),
          },
          model,
        };
      }
    }
  }
}

module.exports = {
  generateChat,
  streamChat,
  getStatus,
};
