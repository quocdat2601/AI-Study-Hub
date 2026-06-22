const chatModel = require('../models/chat.model');
const documentChunkModel = require('../models/document-chunk.model');
const documentModel = require('../models/document.model');
const chatService = require('./chat.service');
const aiUsageService = require('./ai-usage.service');
const aiProviderService = require('./ai-provider.service');
const documentService = require('./document.service');
const documentTextService = require('./document-text.service');
const embeddingService = require('./embedding.service');
const ragService = require('./rag.service');
const supabaseService = require('./supabase.service');
const createError = require('../utils/createError');

const MAX_QUESTION_CHARS = 2000;
const ANSWER_MODES = new Set(['hybrid', 'document_only']);
const RAG_CONTEXT_LIMIT = 4;
const VECTOR_SCORE_WEIGHT = 0.7;
const KEYWORD_SCORE_WEIGHT = 0.3;

function normalizeNumericId(value, fieldName) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw createError(400, `${fieldName} is invalid`);
  }
  return numericValue;
}

function cleanQuestion(question) {
  const cleaned = String(question || '').trim();
  if (!cleaned) {
    throw createError(400, 'Question is required');
  }
  if (cleaned.length > MAX_QUESTION_CHARS) {
    throw createError(400, `Question is too long. Maximum is ${MAX_QUESTION_CHARS} characters`);
  }
  return cleaned;
}

function normalizeAnswerMode(mode) {
  const normalizedMode = String(mode || 'hybrid').trim().toLowerCase();
  if (!ANSWER_MODES.has(normalizedMode)) {
    throw createError(400, 'Answer mode must be hybrid or document_only');
  }
  return normalizedMode;
}

function getMimeType(doc) {
  return doc.cloud_files?.mime_type || '';
}

function estimatePromptTokens({ question, chunks }) {
  const chars = String(question || '').length + (chunks || []).reduce((total, chunk) => {
    return total + String(chunk.content || '').length;
  }, 0);
  return Math.ceil(chars / 4);
}

async function extractTextFromStorage(doc) {
  const storagePath = doc.cloud_files?.storage_path;
  const mimeType = getMimeType(doc);

  if (!storagePath) {
    throw createError(404, 'Document file not found');
  }

  const canExtractFromStorage = mimeType === documentTextService.MIME_TYPES.PDF
    || documentTextService.IMAGE_MIME_TYPES.has(mimeType);

  if (!canExtractFromStorage) {
    throw createError(400, 'Only PDF and image OCR processing is supported in this temporary workspace');
  }

  const buffer = await supabaseService.downloadFile(storagePath);
  return documentTextService.extractTextFromBuffer(buffer, mimeType);
}

async function getProcessableDocument({ id, userId, allowSessionScoped = false, sessionId }) {
  const docId = normalizeNumericId(id, 'documentId');
  const doc = allowSessionScoped
    ? await documentModel.findActiveSessionScopedById(docId, sessionId)
    : await documentService.canUseDocumentInChat(userId, docId);
  if (!doc) {
    throw createError(404, 'Document not found');
  }
  if (allowSessionScoped && String(doc.user_id) !== String(userId)) {
    throw createError(404, 'Document not found');
  }
  return doc;
}

async function processDocument({
  id,
  userId,
  sendEvent,
  force = false,
  allowSessionScoped = false,
  sessionId,
}) {
  const doc = await getProcessableDocument({ id, userId, allowSessionScoped, sessionId });
  const existingText = String(doc.extracted_text || '').trim();
  let text = existingText;
  let extractionStatus = doc.extraction_status;
  let extractionError = doc.extraction_error || null;
  let savedDoc = doc;

  if (
    force
    || extractionStatus !== 'ready'
    || !documentTextService.isExtractedTextUseful(text)
  ) {
    const extraction = await extractTextFromStorage(doc);
    text = extraction.text;
    extractionStatus = extraction.status;
    extractionError = extraction.error;
    savedDoc = await documentModel.updateExtraction(doc.id, extraction);
  }

  if (extractionStatus !== 'ready' || !text) {
    throw createError(400, extractionError || 'No readable document text is available');
  }

  const chunks = ragService.splitTextIntoChunks(text, {
    documentId: doc.id,
    documentTitle: savedDoc.title,
  });

  if (!chunks.length) {
    throw createError(400, 'No readable document chunks could be created');
  }

  let chunksToSave;
  try {
    sendEvent?.('status', { message: 'Creating embeddings...' });
    chunksToSave = await embeddingService.embedChunks(chunks);
  } catch (err) {
    console.error('Document chunk embedding failed:', err.message);
    chunksToSave = embeddingService.markChunksEmbeddingFailed(chunks, err);
  }

  const savedChunks = await documentChunkModel.replaceForDocument(doc.id, chunksToSave);

  return {
    document: savedDoc,
    chunkCount: savedChunks.length,
    status: 'ready',
  };
}

async function safeTouchSession(sessionId) {
  try {
    await chatModel.touchSession(sessionId);
  } catch (err) {
    console.error('Chat session touch failed:', err.message);
  }
}

async function getOrCreateChunksForAsk({ doc, userId, sendEvent }) {
  let chunks = await documentChunkModel.findByDocumentId(doc.id);

  if (chunks.length) {
    return { chunks, autoProcessed: false };
  }

  sendEvent?.('status', { message: 'Preparing document for AI...' });
  await processDocument({ id: doc.id, userId, sendEvent });
  chunks = await documentChunkModel.findByDocumentId(doc.id);

  if (!chunks.length) {
    throw createError(400, 'No document chunks are available after processing');
  }

  return { chunks, autoProcessed: true };
}

function getChunkKey(chunk) {
  return chunk.id == null ? `index:${chunk.chunk_index}` : `id:${chunk.id}`;
}

function mergeHybridChunks({ vectorChunks, keywordChunks, embeddingModel, limit = RAG_CONTEXT_LIMIT }) {
  const maxKeywordScore = Math.max(
    0,
    ...keywordChunks.map((chunk) => Number(chunk.score || 0))
  );
  const merged = new Map();

  for (const chunk of vectorChunks) {
    const vectorScore = Number(chunk.similarity || chunk.score || 0);
    merged.set(getChunkKey(chunk), {
      ...chunk,
      similarity: chunk.similarity == null ? vectorScore : Number(chunk.similarity),
      vectorScore,
      keywordScore: 0,
    });
  }

  for (const chunk of keywordChunks) {
    const key = getChunkKey(chunk);
    const keywordScore = Number(chunk.score || 0);
    const existing = merged.get(key);

    if (existing) {
      merged.set(key, {
        ...existing,
        keywordScore,
        metadata: {
          ...(existing.metadata || {}),
          ...(chunk.metadata || {}),
        },
      });
    } else {
      merged.set(key, {
        ...chunk,
        similarity: null,
        vectorScore: 0,
        keywordScore,
      });
    }
  }

  return [...merged.values()]
    .map((chunk) => {
      const normalizedKeywordScore = maxKeywordScore > 0
        ? Number(chunk.keywordScore || 0) / maxKeywordScore
        : 0;
      const vectorScore = Number(chunk.vectorScore || 0);
      const hasVector = vectorScore > 0;
      const hasKeyword = Number(chunk.keywordScore || 0) > 0;
      const retrieval = hasVector && hasKeyword ? 'hybrid' : hasVector ? 'vector' : 'keyword';
      const combinedScore = (VECTOR_SCORE_WEIGHT * vectorScore)
        + (KEYWORD_SCORE_WEIGHT * normalizedKeywordScore);

      return {
        ...chunk,
        score: combinedScore,
        metadata: {
          ...(chunk.metadata || {}),
          retrieval,
          embeddingModel,
          vectorScore,
          keywordScore: Number(chunk.keywordScore || 0),
          normalizedKeywordScore,
        },
      };
    })
    .sort((a, b) => b.score - a.score || Number(a.chunk_index || 0) - Number(b.chunk_index || 0))
    .slice(0, limit);
}

function buildAssistantMetadata({
  provider,
  model,
  mode,
  usedRag,
  sources = [],
  needsProcessing = false,
  processingError = null,
}) {
  const retrievalTypes = [...new Set(
    sources
      .map((source) => source.metadata?.retrieval)
      .filter(Boolean)
  )];

  return {
    provider,
    model,
    mode,
    usedRag: Boolean(usedRag),
    needsProcessing: Boolean(needsProcessing),
    processingError,
    retrieval: retrievalTypes.length === 1 ? retrievalTypes[0] : retrievalTypes,
    sources,
  };
}

async function retrieveChunksForQuestion({ docId, question, chunks }) {
  const keywordChunks = ragService.retrieveRelevantChunks(question, chunks, RAG_CONTEXT_LIMIT);

  try {
    const queryEmbedding = await embeddingService.embedQuery(question);
    const vectorChunks = await documentChunkModel.matchByEmbedding({
      docId,
      embedding: queryEmbedding.embedding,
      limit: RAG_CONTEXT_LIMIT,
    });

    if (vectorChunks.length) {
      return mergeHybridChunks({
        vectorChunks,
        keywordChunks,
        embeddingModel: queryEmbedding.model,
      });
    }
  } catch (err) {
    console.error('Vector retrieval failed, falling back to keyword retrieval:', err.message);
  }

  return keywordChunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...(chunk.metadata || {}),
      retrieval: 'keyword',
    },
  }));
}

async function getUsageBestEffort({ model, userId }) {
  return aiUsageService.getUsage({ model, userId }).catch((err) => {
    console.error('AI usage refresh failed after answer:', err.message);
    return null;
  });
}

async function saveAssistantAnswer({ sessionId, answer, provider, model, mode, usedRag, sources }) {
  const assistantMetadata = buildAssistantMetadata({
    provider,
    model,
    mode,
    usedRag,
    sources,
  });
  const assistantMessage = await chatModel.addMessage(sessionId, 'assistant', answer, assistantMetadata);
  await safeTouchSession(sessionId);
  return assistantMessage;
}

async function prepareAskDocument({ id, userId, question, mode, model, sendEvent }) {
  const cleanedQuestion = cleanQuestion(question);
  const answerMode = normalizeAnswerMode(mode);
  const selectedProviderModel = aiUsageService.resolveModel(model);
  const selectedModel = selectedProviderModel.model;
  const selectedProvider = selectedProviderModel.provider;
  sendEvent?.('status', { message: 'Checking document...' });
  const doc = await getProcessableDocument({ id, userId });
  const session = await chatService.getOrCreateSession({ userId, docId: doc.id });
  const userMessage = await chatModel.addMessage(session.id, 'user', cleanedQuestion);

  let chunks;
  let autoProcessed;
  try {
    ({ chunks, autoProcessed } = await getOrCreateChunksForAsk({ doc, userId, sendEvent }));
  } catch (err) {
    if (err.statusCode !== 400) throw err;
    const answer = 'I could not prepare this document for AI automatically. Please make sure it is a readable text-based PDF, then try asking again.';
    const assistantMetadata = buildAssistantMetadata({
      provider: 'system',
      model: null,
      mode: answerMode,
      usedRag: false,
      needsProcessing: true,
      processingError: err.message,
    });
    const assistantMessage = await chatModel.addMessage(session.id, 'assistant', answer, assistantMetadata);
    await safeTouchSession(session.id);

    return {
      systemResponse: {
        answer,
        sources: [],
        document: {
          id: doc.id,
          title: doc.title,
        },
        sessionId: session.id,
        mode: answerMode,
        needsProcessing: true,
        processingError: err.message,
        usedRag: false,
        provider: 'system',
        model: null,
        messages: {
          user: userMessage,
          assistant: assistantMessage,
        },
      },
    };
  }

  sendEvent?.('status', { message: 'Searching relevant chunks...' });
  const relevantChunks = await retrieveChunksForQuestion({
    docId: doc.id,
    question: cleanedQuestion,
    chunks,
  });

  if (!relevantChunks.length) {
    throw createError(400, 'No document context is available for this question');
  }

  const estimatedTokens = estimatePromptTokens({ question: cleanedQuestion, chunks: relevantChunks });
  if (selectedProvider === 'gemini') {
    await aiUsageService.assertQuota({ model: selectedModel, userId, estimatedTokens });
  }

  const sources = ragService.buildSourcePayload(relevantChunks);

  return {
    cleanedQuestion,
    answerMode,
    selectedProvider,
    selectedModel,
    doc,
    session,
    userMessage,
    relevantChunks,
    sources,
    autoProcessed,
  };
}

async function askDocument({ id, userId, question, mode, model }) {
  const prepared = await prepareAskDocument({ id, userId, question, mode, model });
  if (prepared.systemResponse) {
    return prepared.systemResponse;
  }

  const {
    cleanedQuestion,
    answerMode,
    selectedProvider,
    selectedModel,
    doc,
    session,
    userMessage,
    relevantChunks,
    sources,
    autoProcessed,
  } = prepared;
  let generationResult;

  try {
    generationResult = await aiProviderService.generateAnswer({
      provider: selectedProvider,
      question: cleanedQuestion,
      documentTitle: doc.title,
      chunks: relevantChunks,
      mode: answerMode,
      model: selectedModel,
    });

    await aiUsageService.logGeminiRequest({
      userId,
      docId: doc.id,
      provider: selectedProvider,
      model: selectedModel,
      requestType: 'document_qa',
      promptTokens: generationResult.usageMetadata?.promptTokens,
      completionTokens: generationResult.usageMetadata?.completionTokens,
      totalTokens: generationResult.usageMetadata?.totalTokens,
      success: true,
    });
  } catch (err) {
    await aiUsageService.logGeminiRequest({
      userId,
      docId: doc.id,
      provider: selectedProvider,
      model: selectedModel,
      requestType: 'document_qa',
      success: false,
      errorCode: err.code || err.statusCode || err.name || 'gemini_error',
    });
    if (err.publicMessage) {
      throw err;
    }
    throw createError(503, 'AI service is temporarily unavailable. Please try again');
  }

  const answer = generationResult.answer;
  const assistantMessage = await saveAssistantAnswer({
    sessionId: session.id,
    answer,
    provider: selectedProvider,
    model: selectedModel,
    mode: answerMode,
    usedRag: true,
    sources,
  });
  const usage = await getUsageBestEffort({ model: selectedModel, userId });

  return {
    answer,
    sources,
    document: {
      id: doc.id,
      title: doc.title,
    },
    sessionId: session.id,
    mode: answerMode,
    usedRag: true,
    autoProcessed,
    provider: selectedProvider,
    model: selectedModel,
    usage,
    messages: {
      user: userMessage,
      assistant: assistantMessage,
    },
  };
}

async function askDocumentStream({ id, userId, question, mode, model, sendEvent }) {
  const prepared = await prepareAskDocument({ id, userId, question, mode, model, sendEvent });
  if (prepared.systemResponse) {
    sendEvent('token', { text: prepared.systemResponse.answer });
    sendEvent('done', prepared.systemResponse);
    return;
  }

  const {
    cleanedQuestion,
    answerMode,
    selectedProvider,
    selectedModel,
    doc,
    session,
    userMessage,
    relevantChunks,
    sources,
    autoProcessed,
  } = prepared;

  let answer = '';
  let usageMetadata = null;
  sendEvent('status', { message: 'Generating answer...' });

  try {
    for await (const event of aiProviderService.streamAnswer({
      provider: selectedProvider,
      question: cleanedQuestion,
      documentTitle: doc.title,
      chunks: relevantChunks,
      mode: answerMode,
      model: selectedModel,
    })) {
      if (event.type === 'token' && event.text) {
        answer += event.text;
        sendEvent('token', { text: event.text });
      } else if (event.type === 'usage') {
        usageMetadata = event.usageMetadata;
      }
    }

    await aiUsageService.logGeminiRequest({
      userId,
      docId: doc.id,
      provider: selectedProvider,
      model: selectedModel,
      requestType: 'document_qa',
      promptTokens: usageMetadata?.promptTokens,
      completionTokens: usageMetadata?.completionTokens,
      totalTokens: usageMetadata?.totalTokens,
      success: true,
    });
  } catch (err) {
    await aiUsageService.logGeminiRequest({
      userId,
      docId: doc.id,
      provider: selectedProvider,
      model: selectedModel,
      requestType: 'document_qa',
      success: false,
      errorCode: err.code || err.statusCode || err.name || 'stream_error',
    });
    throw err.publicMessage ? err : createError(503, 'AI service is temporarily unavailable. Please try again');
  }

  const assistantMessage = await saveAssistantAnswer({
    sessionId: session.id,
    answer,
    provider: selectedProvider,
    model: selectedModel,
    mode: answerMode,
    usedRag: true,
    sources,
  });
  const usage = await getUsageBestEffort({ model: selectedModel, userId });

  sendEvent('done', {
    answer,
    sources,
    document: {
      id: doc.id,
      title: doc.title,
    },
    sessionId: session.id,
    mode: answerMode,
    usedRag: true,
    autoProcessed,
    provider: selectedProvider,
    model: selectedModel,
    usage,
    messages: {
      user: userMessage,
      assistant: assistantMessage,
    },
  });
}

module.exports = {
  processDocument,
  askDocument,
  askDocumentStream,
};
