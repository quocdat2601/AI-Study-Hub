const aiProviders = require('../config/ai-providers');
const geminiService = require('./gemini.service');
const ollamaService = require('./ollama.service');
const chatContextService = require('./chat-context.service');

function logImagePromptDebug({ provider, model, imageQuestionType, systemPrompt, userPrompt }) {
  if (process.env.NODE_ENV === 'production' || !imageQuestionType) return;
  const imageSection = systemPrompt
    .split('\n\n')
    .find((section) => section.includes('OCR-extracted text') || section.includes('visual-image question'))
    || '';
  console.info('[image-ocr-debug] provider-prompt', {
    provider,
    model,
    imageQuestionType,
    imageInstruction: imageSection,
    hasOcrContextLabel: userPrompt.includes('Retrieved OCR text chunks'),
  });
}

function buildModeInstruction(mode, { provider } = {}) {
  const languageInstruction = [
    'Answer in the same language as the current user question.',
    'If the current question language is unclear or mixed, answer in Vietnamese.',
    provider === 'ollama'
      ? 'CRITICAL: You MUST reply entirely in Vietnamese. Never use Chinese characters or Chinese sentences, even partially.'
      : '',
  ].filter(Boolean).join('\n');

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
  return `[${index + 1}]${title ? ` Document: ${title}` : ''} (chunk ${chunkIndex}${pageLabel})`;
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
  imageQuestionType,
  provider,
  verificationBadge,
}) {
  const context = (chunks || [])
    .map((chunk, index) => `${buildSourceLabel(chunk, index)}\n${chunk.promptContent || chunk.content}`)
    .join('\n\n');
  const selectedTitles = (documentTitles || [documentTitle])
    .map((title) => String(title || '').trim())
    .filter(Boolean);
  const hasLoadedEvidence = Boolean((chunks || []).length || overviewContext);
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
  const imageInstruction = imageQuestionType === 'image_multiple_choice_question'
    ? [
      'The following evidence is OCR-extracted text from the user\'s selected image.',
      'It contains a multiple-choice question.',
      'Read the question and all answer choices.',
      'Choose the best answer and explain briefly.',
      'If an OCR segment is unclear, identify the unclear segment instead of inventing it.',
      'Do not ask the user to provide the image or question again.',
      mode === 'document_only'
        ? 'In document_only mode, answer only if the OCR evidence contains enough information; otherwise say the evidence is insufficient.'
        : 'In hybrid mode, you may use general study knowledge to choose among the OCR answer choices, but do not invent missing OCR text.',
    ].join('\n')
    : imageQuestionType === 'image_question_answering'
      ? [
        'The following evidence is OCR-extracted text from the user\'s selected image.',
        'Answer the question contained in the OCR evidence and explain briefly.',
        'Do not ask what question the user wants answered if the OCR evidence already contains a readable question.',
        'Do not claim that you cannot inspect the image when OCR evidence is present.',
      ].join('\n')
      : imageQuestionType === 'image_text_transcription'
        ? [
          'The following evidence is OCR-extracted text from the user\'s attached image.',
          'Answer what text appears in the image using this OCR evidence.',
          'Do not claim that you cannot inspect the image.',
          'If OCR text is incomplete, state only which parts are unclear.',
          'Do not describe visual objects, layout, charts, or non-text content unless the OCR chunks explicitly contain that text.',
        ].join('\n')
        : imageQuestionType === 'image_summary'
          ? [
            'The following evidence is OCR-extracted text from the user\'s selected image.',
            'Summarize the OCR text from the image. Do not describe visual objects or layout unless the OCR text states them.',
            'Do not claim that the image is inaccessible when OCR evidence is present.',
          ].join('\n')
          : imageQuestionType === 'image_visual_question'
      ? [
        'This is a visual-image question, but this endpoint only receives text chunks.',
        'Do not pretend to inspect the image visually.',
      ].join('\n')
      : '';
  const systemPrompt = [
    "You are AI Study Hub's study assistant.",
    buildModeInstruction(mode, { provider }),
    'The current user request has priority over earlier formatting preferences.',
    'Conversation history provides conversational context only. It is never document evidence, and facts from history must not be reused unless supported by the current source chunks.',
    hasLoadedEvidence
      ? 'The requested documents are already attached, authorized, and loaded as evidence. Never ask the user to upload, share, or provide those same files again.'
      : '',
    'Do not use canned headings such as "Based on the compared documents", "Dựa trên tài liệu", or "Dựa trên tài liệu được so sánh". Start directly with the answer unless the user explicitly requests headings.',
    'When answering based on retrieved source chunks, you MUST insert inline citations (e.g. "[1]", "[2]") immediately after each sentence or clause that references information from that source chunk. Do not invent citation numbers that are not in the list of source chunks. Do not add text like "Source [1]" or "Chunk [1]", just write "[1]".',
    ...constraintInstructions,
    comparisonInstruction,
    multiDocumentInstruction,
    overviewInstruction,
    imageInstruction,
    verificationBadge || '',
  ].filter(Boolean).join('\n\n');
  const userPrompt = [
    historyText ? `Recent conversation context:\n${historyText}` : '',
    substantiveQuestion ? `Active substantive question:\n${substantiveQuestion}` : '',
    retrievalQuery ? `Current retrieval topic (do not broaden it):\n${retrievalQuery}` : '',
    `Selected document titles:\n${selectedTitles.join('\n') || 'Untitled document'}`,
    overviewContext ? `Persisted document overview context:\n${overviewContext}` : '',
    imageQuestionType && imageQuestionType !== 'image_visual_question'
      ? `Retrieved OCR text chunks:\n${context || 'No OCR text chunks were available.'}`
      : `Retrieved source chunks:\n${context || 'No source chunks were available.'}`,
    `Current user question:\n${question}`,
  ].filter(Boolean).join('\n\n');

  return { systemPrompt, userPrompt };
}

async function generateAnswer(options) {
  const { provider, model, question, documentTitle, chunks, mode } = options;
  const prompts = buildRagPrompts(options);
  logImagePromptDebug({
    provider,
    model,
    imageQuestionType: options.imageQuestionType,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
  });

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
  logImagePromptDebug({
    provider,
    model,
    imageQuestionType: options.imageQuestionType,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
  });

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
