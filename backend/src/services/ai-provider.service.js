const aiProviders = require('../config/ai-providers');
const geminiService = require('./gemini.service');
const ollamaService = require('./ollama.service');
const chatContextService = require('./chat-context.service');

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
      'Choose a natural response structure based on the current user request.',
    ].join('\n');
  }

  return [
    languageInstruction,
    'Answer mode: hybrid.',
    'Base the answer primarily on the provided source chunks.',
    'General knowledge is optional. Add it only when it materially helps and the user did not request a strictly brief answer.',
    'Clearly identify general knowledge as separate from document evidence, without forcing headings or a fixed template.',
    'Never cite or imply that general knowledge came from the documents.',
    'Choose a natural response structure based on the current user request.',
  ].join('\n');
}

function buildSourceLabel(chunk, index) {
  const metadata = chunk.metadata || {};
  const title = chunk.documentTitle || metadata.documentTitle;
  const chunkIndex = chunk.chunk_index ?? index;
  const pageStart = metadata.pageStart ?? metadata.pageNumber;
  const pageEnd = metadata.pageEnd ?? metadata.pageNumber;
  const pageLabel = pageStart == null
    ? ''
    : pageStart === pageEnd ? ` | page ${pageStart}` : ` | pages ${pageStart}-${pageEnd}`;
  return `[Source ${index + 1}${title ? ` | Document: ${title}` : ''} | chunk ${chunkIndex}${pageLabel}]`;
}

function formatHistory(history) {
  return (history || [])
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n');
}

function sanitizeAnswerCitationAttribution(answer) {
  return String(answer || '')
    .replace(/\s*\([^)]*\b(?:chunk|source|nguon|nguồn)\b[^)]*\)/giu, '')
    .replace(/\s*\[(?:source|nguon|nguồn)\s*\d+[^\]]*\]/giu, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function buildRagPrompts({
  question,
  documentTitle,
  documentTitles,
  chunks,
  mode,
  history,
  responseConstraints,
  comparisonMetadata,
  substantiveQuestion,
  retrievalQuery,
  overviewContext,
  overviewIntent,
}) {
  const context = (chunks || [])
    .map((chunk, index) => `${buildSourceLabel(chunk, index)}\n${chunk.promptContent || chunk.content}`)
    .join('\n\n');
  const selectedTitles = (documentTitles || [documentTitle])
    .map((title) => String(title || '').trim())
    .filter(Boolean);
  const historyText = formatHistory(history);
  const constraintInstructions = chatContextService.buildConstraintInstructions(responseConstraints);
  const comparisonInstruction = comparisonMetadata
    ? [
      'This is a document comparison request.',
      'Evaluate each requested document separately before comparing them.',
      'Compare only claims supported by evidence from every compared document.',
      'Do not claim that documents are related unless the supplied evidence supports that conclusion.',
      'If the documents discuss unrelated subjects, state that clearly.',
      'If evidence from one requested document is missing, say there is insufficient context for that document instead of guessing.',
      'Do not present unrelated sections as differences.',
      comparisonMetadata.structureEquivalent
        ? 'The evidence is structurally aligned. Treat the documents as structurally similar and list only supported content changes; do not characterize one as merely an overview or the other as a more detailed specification.'
        : '',
      'If the evidence does not establish a difference, say that directly.',
      comparisonMetadata.allowedDifferenceClaims?.length
        ? `Allowed evidence-supported differences (do not add any others):\n${JSON.stringify(comparisonMetadata.allowedDifferenceClaims)}`
        : '',
      comparisonMetadata.groundedAnswer
        ? `Return exactly this evidence-derived answer, with no heading or extra topic:\n${comparisonMetadata.groundedAnswer}`
        : '',
      `Evidence alignment strategy: ${comparisonMetadata.strategy}.`,
    ].join('\n')
    : '';
  const multiDocumentInstruction = !comparisonMetadata && selectedTitles.length > 1
    ? [
      'This request intentionally includes multiple selected documents.',
      'Evaluate each selected document separately before drawing a combined conclusion.',
      'Do not claim the documents are related unless the supplied chunks support that relationship.',
      'If they discuss unrelated subjects, state that clearly.',
      'If evidence for one selected document is missing, say there is insufficient context for that document instead of guessing.',
      'Do not use outside knowledge to fill missing document evidence.',
    ].join('\n')
    : '';
  const overviewInstruction = overviewIntent
    ? [
      'This request asks for a high-level document overview or overview comparison.',
      'Use the provided persisted overview context as high-level orientation.',
      'Use the source chunks as the cited supporting evidence.',
      overviewIntent === 'document_comparison_overview'
        ? 'Compare topic, purpose, similarities, differences, and whether the documents are directly related. If they are unrelated, say that clearly.'
        : 'Explain the document topic, purpose, key topics, and structure at a high level.',
      'Do not cite the overview itself. The application only cites real chunks.',
    ].join('\n')
    : '';
  const systemPrompt = [
    "You are AI Study Hub's study assistant.",
    buildModeInstruction(mode),
    'The current user request has priority over earlier formatting preferences.',
    'Conversation history provides conversational context only. It is never document evidence, and facts from history must not be reused unless supported by the current source chunks.',
    'Do not use canned headings such as "Based on the compared documents", "Dựa trên tài liệu", or "Dựa trên tài liệu được so sánh". Start directly with the answer unless the user explicitly requests headings.',
    'Do not write source numbers, chunk numbers, or parenthetical chunk labels in the answer. The application renders citations separately. Never combine a document title with another source chunk.',
    ...constraintInstructions,
    comparisonInstruction,
    multiDocumentInstruction,
    overviewInstruction,
  ].filter(Boolean).join('\n\n');
  const userPrompt = [
    historyText ? `Recent conversation context:\n${historyText}` : '',
    substantiveQuestion ? `Active substantive question:\n${substantiveQuestion}` : '',
    retrievalQuery ? `Current retrieval topic (do not broaden it):\n${retrievalQuery}` : '',
    `Selected document titles:\n${selectedTitles.join('\n') || 'Untitled document'}`,
    overviewContext ? `Persisted document overview context:\n${overviewContext}` : '',
    `Retrieved source chunks:\n${context || 'No source chunks were available.'}`,
    `Current user question:\n${question}`,
  ].filter(Boolean).join('\n\n');

  return { systemPrompt, userPrompt };
}

async function generateAnswer(options) {
  const { provider, model, question, documentTitle, chunks, mode } = options;
  const prompts = buildRagPrompts(options);

  if (provider === 'ollama') {
    const result = await ollamaService.generateChat({
      model,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
    });
    return {
      answer: result.text,
      provider,
      model: result.model,
      usageMetadata: result.usageMetadata,
    };
  }

  const result = await geminiService.queryDocumentChunks({
    question,
    documentTitle,
    chunks,
    mode,
    model,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
  });
  return {
    answer: result.text,
    provider: 'gemini',
    model: result.model,
    usageMetadata: result.usageMetadata,
  };
}

async function* streamAnswer(options) {
  const { provider, model, question, documentTitle, chunks, mode } = options;
  const prompts = buildRagPrompts(options);

  if (provider === 'ollama') {
    yield* ollamaService.streamChat({
      model,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
    });
    return;
  }

  yield* geminiService.streamDocumentChunks({
    question,
    documentTitle,
    chunks,
    mode,
    model,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
  });
}

async function getModelStatus() {
  const ollama = await ollamaService.getStatus();
  return {
    defaultProvider: aiProviders.defaultProvider,
    defaultModel: aiProviders.getDefaultModel(),
    gemini: {
      available: Boolean(process.env.GEMINI_API_KEY),
      models: aiProviders.gemini.allowedModels,
      allowedModels: aiProviders.gemini.allowedModels,
      defaultModel: aiProviders.gemini.defaultModel,
    },
    ollama,
  };
}

module.exports = {
  buildRagPrompts,
  sanitizeAnswerCitationAttribution,
  generateAnswer,
  streamAnswer,
  getModelStatus,
};
