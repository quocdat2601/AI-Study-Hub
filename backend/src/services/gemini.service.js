const { genAI, modelName } = require('../config/gemini');

const GEMINI_TIMEOUT_MS = 15000;

function withTimeout(promise, timeoutMs) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
        const err = new Error('Gemini request timed out');
        err.publicMessage = 'AI service is temporarily unavailable. Please try again';
        err.statusCode = 503;
        reject(err);
      }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function queryDocument(question, documentText) {
  if (!genAI) {
    const err = new Error('Gemini API key is not configured');
    err.publicMessage = 'AI service is temporarily unavailable. Please try again';
    err.statusCode = 503;
    throw err;
  }

  const prompt = `You are a study assistant. Answer ONLY using the document text below. Do not use outside knowledge. If the answer is not in the document, say so clearly.\n\n[Document]\n${documentText}\n\n[Question]\n${question}`;
  const response = await withTimeout(
    genAI.models.generateContent({
      model: modelName,
      contents: prompt,
    }),
    GEMINI_TIMEOUT_MS
  );

  return response.text || '';
}

module.exports = { queryDocument };
