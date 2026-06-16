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

  const prompt = `You are a study assistant. Answer in the same language as the user question. If the language is unclear or mixed, answer in Vietnamese. Answer ONLY using the document text below. Do not use outside knowledge. If the answer is not in the document, say so clearly.\n\n[Document]\n${documentText}\n\n[Question]\n${question}`;
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
  const languageInstruction = [
    'Answer in the same language as the user question.',
    'If the user question language is unclear or mixed, answer in Vietnamese.',
  ].join('\n');

  if (mode === 'document_only') {
    return [
      languageInstruction,
      'Answer mode: document_only.',
      'Use only the provided source chunks.',
      'Do not use outside knowledge.',
      'If the chunks do not contain the answer, say clearly that the document does not contain enough information.',
    ].join('\n');
  }

  return [
    languageInstruction,
    'Answer mode: hybrid.',
    'Always use two sections in the response language.',
    'For English answers, title the sections exactly "Based on the document" and "Additional study explanation".',
    'For Vietnamese answers, title the sections exactly "Dựa trên tài liệu" and "Giải thích bổ sung".',
    'In the document-based section, answer only from the provided source chunks.',
    'If the chunks are insufficient, explicitly say: "The document does not provide enough information to fully answer this."',
    'In the additional explanation section, add concise general academic or software knowledge that helps the student understand the topic.',
    'Do not cite or imply that general knowledge came from the document.',
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

async function* streamDocumentChunks({ question, documentTitle, chunks, mode = 'hybrid', model = modelName, systemPrompt, userPrompt }) {
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

  const stream = await genAI.models.generateContentStream({
    model,
    contents: prompt,
  });

  for await (const chunk of stream) {
    const text = chunk.text || '';
    if (text) {
      yield { type: 'token', text };
    }
    if (chunk.usageMetadata || chunk.usage_metadata) {
      yield { type: 'usage', usageMetadata: extractUsageMetadata(chunk), model };
    }
  }
}

module.exports = { queryDocument, queryDocumentChunks, streamDocumentChunks };
