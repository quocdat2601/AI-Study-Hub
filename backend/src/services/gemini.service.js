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

function extractUsageMetadata(response) {
  const usage = response.usageMetadata || response.usage_metadata || {};
  return {
    promptTokens: Number(usage.promptTokenCount || usage.prompt_token_count || 0),
    completionTokens: Number(usage.candidatesTokenCount || usage.candidates_token_count || 0),
    totalTokens: Number(usage.totalTokenCount || usage.total_token_count || 0),
  };
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

function buildModeInstruction(mode) {
  if (mode === 'document_only') {
    return [
      'Answer mode: document_only.',
      'Use only the provided source chunks.',
      'Do not use outside knowledge.',
      'If the chunks do not contain the answer, say clearly that the document does not contain enough information.',
    ].join('\n');
  }

  return [
    'Answer mode: hybrid.',
    'Start with a section titled "Based on the document".',
    'Use the source chunks for that section only.',
    'If the source chunks are insufficient, explicitly say: "The document does not provide enough information to fully answer this."',
    'Then, when useful, add a separate section titled "Additional explanation" using general academic or software knowledge.',
    'Do not pretend general knowledge came from the document.',
    'Keep the answer concise and useful.',
  ].join('\n');
}

async function queryDocumentChunks({ question, documentTitle, chunks, mode = 'hybrid', model = modelName, systemPrompt, userPrompt }) {
  if (!genAI) {
    const err = new Error('Gemini API key is not configured');
    err.publicMessage = 'AI service is temporarily unavailable. Please try again';
    err.statusCode = 503;
    throw err;
  }

  const context = (chunks || [])
    .map((chunk, index) => {
      const label = chunk.chunk_index ?? index;
      return `[Source ${index + 1} | chunk ${label}]\n${chunk.content}`;
    })
    .join('\n\n');

  const prompt = systemPrompt && userPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : `You are AI Study Hub's study assistant.\n\nSelected document title:\n${documentTitle || 'Untitled document'}\n\nRetrieved source chunks:\n${context || 'No source chunks were available.'}\n\nUser question:\n${question}\n\n${buildModeInstruction(mode)}`;

  const response = await withTimeout(
    genAI.models.generateContent({
      model,
      contents: prompt,
    }),
    GEMINI_TIMEOUT_MS
  );

  return {
    text: response.text || '',
    usageMetadata: extractUsageMetadata(response),
    model,
  };
}

module.exports = { queryDocument, queryDocumentChunks };
