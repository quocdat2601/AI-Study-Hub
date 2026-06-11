const { genAI, modelName } = require('../config/gemini');

const GEMINI_TIMEOUT_MS = 15000;

function createServiceError(message, statusCode = 503) {
  const err = new Error(message);
  err.publicMessage = message;
  err.statusCode = statusCode;
  return err;
}

function withTimeout(promise, timeoutMs) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(createServiceError('AI service is temporarily unavailable. Please try again'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function readGeminiText(response) {
  const text = String(response?.text || '').trim();
  if (text) return text;

  const parts = response?.candidates?.[0]?.content?.parts || [];
  const joined = parts
    .map((part) => String(part?.text || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return joined;
}

async function queryDocument(question, documentText) {
  if (!genAI) {
    throw createServiceError('AI service is temporarily unavailable. Please try again');
  }

  const prompt = [
    'You are a study assistant.',
    'Answer ONLY using the document text below.',
    'Do not use outside knowledge.',
    'If the answer is not in the document, say so clearly.',
    '',
    '[Document]',
    documentText,
    '',
    '[Question]',
    question,
  ].join('\n');

  try {
    const response = await withTimeout(
      genAI.models.generateContent({
        model: modelName,
        contents: prompt,
      }),
      GEMINI_TIMEOUT_MS
    );

    const answer = readGeminiText(response);
    if (!answer) {
      throw createServiceError('AI returned an empty response. Please try again');
    }

    return answer;
  } catch (err) {
    if (err.publicMessage) {
      throw err;
    }

    const rawMessage = String(err?.message || '');
    if (rawMessage.includes('API key not valid') || rawMessage.includes('API_KEY_INVALID')) {
      throw createServiceError('AI service is not configured correctly. Please contact support');
    }

    throw createServiceError('AI service is temporarily unavailable. Please try again');
  }
}

module.exports = { queryDocument };
