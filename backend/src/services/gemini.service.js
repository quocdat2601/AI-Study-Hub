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

  const prompt = `You are a study assistant. Answer in the same language as the user question. If the language is unclear or mixed, answer in Vietnamese. Answer ONLY using the document text below. Do not use outside knowledge. If the answer is not in the document, say so clearly. Follow the user's requested length and format without forcing headings.\n\n[Document]\n${documentText}\n\n[Question]\n${question}`;
  const response = await withTimeout(
    genAI.models.generateContent({ model: modelName, contents: prompt }),
    GEMINI_TIMEOUT_MS
  );
  return response.text || '';
}

function buildModeInstruction(mode) {
  const languageInstruction = [
    'Answer in the same language as the current user question.',
    'If the current question language is unclear or mixed, answer in Vietnamese.',
  ].join('\n');
  if (mode === 'document_only') {
    return [
      languageInstruction,
      'Answer mode: document_only.',
      'Use only the provided source chunks.',
      'Do not use outside knowledge.',
      'If the chunks do not contain the answer, say so directly.',
      'Follow explicit brevity and formatting instructions in the current request.',
    ].join('\n');
  }
  return [
    languageInstruction,
    'Answer mode: hybrid.',
    'Base the answer primarily on the provided source chunks.',
    'Add clearly identified general knowledge only when it materially helps.',
    'Do not force headings or a fixed response template.',
    'Follow explicit brevity and formatting instructions in the current request.',
  ].join('\n');
}

function buildFallbackPrompt({ question, documentTitle, chunks, mode }) {
  const context = (chunks || [])
    .map((chunk, index) => {
      const label = chunk.chunk_index ?? index;
      return `[Source ${index + 1} | chunk ${label}]\n${chunk.promptContent || chunk.content}`;
    })
    .join('\n\n');
  return `You are AI Study Hub's study assistant.\n\nSelected document title:\n${documentTitle || 'Untitled document'}\n\nRetrieved source chunks:\n${context || 'No source chunks were available.'}\n\nUser question:\n${question}\n\n${buildModeInstruction(mode)}`;
}

async function queryDocumentChunks({
  question,
  documentTitle,
  chunks,
  mode = 'hybrid',
  model = modelName,
  systemPrompt,
  userPrompt,
}) {
  if (!genAI) {
    const err = new Error('Gemini API key is not configured');
    err.publicMessage = 'AI service is temporarily unavailable. Please try again';
    err.statusCode = 503;
    throw err;
  }
  const prompt = systemPrompt && userPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : buildFallbackPrompt({ question, documentTitle, chunks, mode });
  const response = await withTimeout(
    genAI.models.generateContent({ model, contents: prompt }),
    GEMINI_TIMEOUT_MS
  );
  return {
    text: response.text || '',
    usageMetadata: extractUsageMetadata(response),
    model,
  };
}

async function generateText({
  model = modelName,
  systemPrompt = '',
  userPrompt = '',
  generationConfig,
  timeoutMs = GEMINI_TIMEOUT_MS,
}) {
  if (!genAI) {
    const err = new Error('Gemini API key is not configured');
    err.publicMessage = 'AI service is temporarily unavailable. Please try again';
    err.statusCode = 503;
    throw err;
  }

  const prompt = [systemPrompt, userPrompt].filter(Boolean).join('\n\n');
  const response = await withTimeout(
    genAI.models.generateContent({
      model,
      contents: prompt,
      ...(generationConfig ? { config: generationConfig } : {}),
    }),
    timeoutMs
  );
  return {
    text: response.text || '',
    usageMetadata: extractUsageMetadata(response),
    model,
  };
}

async function* streamDocumentChunks({
  question,
  documentTitle,
  chunks,
  mode = 'hybrid',
  model = modelName,
  systemPrompt,
  userPrompt,
}) {
  if (!genAI) {
    const err = new Error('Gemini API key is not configured');
    err.publicMessage = 'AI service is temporarily unavailable. Please try again';
    err.statusCode = 503;
    throw err;
  }
  const prompt = systemPrompt && userPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : buildFallbackPrompt({ question, documentTitle, chunks, mode });
  const stream = await genAI.models.generateContentStream({ model, contents: prompt });

  for await (const chunk of stream) {
    const text = chunk.text || '';
    if (text) yield { type: 'token', text };
    if (chunk.usageMetadata || chunk.usage_metadata) {
      yield { type: 'usage', usageMetadata: extractUsageMetadata(chunk), model };
    }
  }
}

// Sinh 3–5 tag chủ đề cho tài liệu; ưu tiên tái dùng tag đã có (knownTags) để giữ vocabulary sạch.
async function generateTags({ title, text, knownTags = [], model = modelName }) {
  if (!genAI) {
    const err = new Error('Gemini API key is not configured');
    err.publicMessage = 'AI service is temporarily unavailable. Please try again';
    err.statusCode = 503;
    throw err;
  }

  const knownList = (knownTags || []).slice(0, 50).join(', ');
  const snippet = String(text || '').slice(0, 6000);
  const prompt = [
    'You label study documents with topic tags.',
    'Return ONLY a JSON array of 3 to 5 short lowercase topic tags (strings). No prose, no code fences.',
    'Prefer reusing tags from this existing list when they fit; only invent a new tag when none fits:',
    knownList || '(no existing tags yet)',
    '',
    `Document title: ${title || 'Untitled'}`,
    '',
    `Document content:\n${snippet || '(no extracted text)'}`,
  ].join('\n');

  const response = await withTimeout(
    genAI.models.generateContent({ model, contents: prompt }),
    GEMINI_TIMEOUT_MS
  );

  return {
    text: response.text || '',
    usageMetadata: extractUsageMetadata(response),
    model,
  };
}

module.exports = {
  queryDocument,
  queryDocumentChunks,
  generateText,
  streamDocumentChunks,
  generateTags,
};
