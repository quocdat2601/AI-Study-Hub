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
const ragComparisonService = require('./rag-comparison.service');
const chatContextService = require('./chat-context.service');
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

function estimatePromptTokens({ question, chunks, history, documentTitles, responseConstraints }) {
  const chars = String(question || '').length
    + (chunks || []).reduce((total, chunk) => (
      total + String(chunk.promptContent || chunk.content || '').length
    ), 0)
    + (history || []).reduce((total, message) => total + String(message.content || '').length, 0)
    + (documentTitles || []).join(' ').length
    + JSON.stringify(responseConstraints || {}).length;
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
    pageBoundaries: savedDoc.extraction_metadata?.pageBoundaries || [],
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

async function getOrCreateChunksForAsk({ doc, userId, sessionId, sendEvent }) {
  let chunks = await documentChunkModel.findByDocumentId(doc.id);

  if (chunks.length) {
    return { chunks, autoProcessed: false };
  }

  sendEvent?.('status', { message: 'Preparing document for AI...' });
  await processDocument({
    id: doc.id,
    userId,
    sendEvent,
    allowSessionScoped: doc.document_scope === 'session',
    sessionId,
  });
  chunks = await documentChunkModel.findByDocumentId(doc.id);

  if (!chunks.length) {
    throw createError(400, 'No document chunks are available after processing');
  }

  return { chunks, autoProcessed: true };
}

function getChunkKey(chunk) {
  return chunk.id == null
    ? `doc:${chunk.doc_id || chunk.metadata?.documentId}:index:${chunk.chunk_index}`
    : `id:${chunk.id}`;
}

function buildAuthorizedChunkIndex(chunks) {
  const byKey = new Map();
  for (const chunk of chunks || []) {
    byKey.set(getChunkKey(chunk), chunk);
    const docId = Number(chunk.doc_id || chunk.metadata?.documentId);
    const chunkIndex = Number(chunk.chunk_index);
    if (Number.isInteger(docId) && Number.isInteger(chunkIndex)) {
      byKey.set(`doc:${docId}:index:${chunkIndex}`, chunk);
    }
  }
  return byKey;
}

function normalizeRetrievedChunksToAuthorizedScope(retrievedChunks, authorizedChunks) {
  const authorizedByKey = buildAuthorizedChunkIndex(authorizedChunks);
  return (retrievedChunks || []).map((chunk) => {
    const authorized = authorizedByKey.get(getChunkKey(chunk))
      || authorizedByKey.get(`doc:${Number(chunk.doc_id)}:index:${Number(chunk.chunk_index)}`);
    if (!authorized) return chunk;

    return {
      ...authorized,
      score: chunk.score ?? authorized.score,
      similarity: chunk.similarity ?? authorized.similarity,
      vectorScore: chunk.vectorScore ?? chunk.similarity ?? authorized.vectorScore,
      keywordScore: authorized.keywordScore ?? chunk.keywordScore,
      metadata: {
        ...(authorized.metadata || {}),
        retrieval: chunk.metadata?.retrieval || authorized.metadata?.retrieval,
        embeddingModel: chunk.metadata?.embeddingModel || authorized.metadata?.embeddingModel,
      },
    };
  });
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
  requestContext = null,
  comparisonMetadata = null,
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
    ...(requestContext ? {
      intent: requestContext.intent,
      comparedDocumentIds: requestContext.comparedDocumentIds,
      substantiveQuestion: requestContext.substantiveQuestion,
      retrievalQuery: requestContext.retrievalQuery,
      responseConstraints: requestContext.responseConstraints,
      comparisonDebug: requestContext.comparisonDebug || null,
    } : {}),
    ...(comparisonMetadata ? { comparison: comparisonMetadata } : {}),
  };
}

async function retrieveChunksForQuestion({ docIds, question, chunks }) {
  const keywordChunks = ragService.retrieveRelevantChunks(question, chunks, RAG_CONTEXT_LIMIT);

  try {
    const queryEmbedding = await embeddingService.embedQuery(question);
    const vectorRows = docIds.length === 1
      ? await documentChunkModel.matchByEmbedding({
        docId: docIds[0],
        embedding: queryEmbedding.embedding,
        limit: RAG_CONTEXT_LIMIT,
      })
      : await documentChunkModel.matchByEmbeddingAcrossDocuments({
        docIds,
        embedding: queryEmbedding.embedding,
        limit: RAG_CONTEXT_LIMIT,
      });
    const vectorChunks = normalizeRetrievedChunksToAuthorizedScope(vectorRows, chunks);

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

function logRagValidationDebug({
  sessionId,
  resolvedDocuments,
  retrievedChunks,
  validation,
}) {
  if (!validation?.rejected?.length && process.env.RAG_AUTH_DEBUG !== 'true') return;
  console.info('RAG session authorization validation debug:', {
    sessionId,
    resolvedAttachmentDocumentIds: (resolvedDocuments || []).map((doc) => Number(doc.id)),
    retrievedChunkDocumentIds: [...new Set(
      (retrievedChunks || [])
        .map((chunk) => Number(chunk.doc_id || chunk.metadata?.documentId))
        .filter(Number.isInteger)
    )],
    removedChunkDocumentIds: [...new Set(
      (validation?.rejected || [])
        .map((item) => item.actualDocumentId || item.metadataDocumentId)
        .filter(Number.isInteger)
    )],
    removedReasons: (validation?.rejected || []).map((item) => ({
      reason: item.reason,
      chunkId: item.chunkId,
      actualDocumentId: item.actualDocumentId,
      metadataDocumentId: item.metadataDocumentId,
    })),
  });
}

async function getUsageBestEffort({ model, userId }) {
  return aiUsageService.getUsage({ model, userId }).catch((err) => {
    console.error('AI usage refresh failed after answer:', err.message);
    return null;
  });
}

async function saveAssistantAnswer({
  sessionId,
  answer,
  provider,
  model,
  mode,
  usedRag,
  sources,
  requestContext,
  comparisonMetadata,
}) {
  const assistantMetadata = buildAssistantMetadata({
    provider,
    model,
    mode,
    usedRag,
    sources,
    requestContext,
    comparisonMetadata,
  });
  const assistantMessage = await chatModel.addMessage(sessionId, 'assistant', answer, assistantMetadata);
  await safeTouchSession(sessionId);
  return assistantMessage;
}

function isDocumentReadyForRag(doc) {
  return doc.extraction_status === 'ready'
    && documentTextService.isExtractedTextUseful(doc.extracted_text);
}

async function canUseDocumentThroughOwnedSession({ document, session, userId }) {
  if (!document || !session || String(session.user_id) !== String(userId)) {
    return false;
  }

  if (document.document_scope === 'session') {
    return String(document.user_id) === String(userId)
      && Number(document.origin_session_id) === Number(session.id);
  }

  if (document.document_scope === 'shared') {
    return true;
  }

  return Boolean(await documentService.canAttachDocumentToSession(userId, document.id));
}

async function resolveAuthorizedSessionDocuments({ sessionId, userId }) {
  const normalizedSessionId = normalizeNumericId(sessionId, 'sessionId');
  const session = await chatModel.findOwnedSession(normalizedSessionId, userId);
  if (!session) throw createError(404, 'Chat session not found');

  const links = await chatModel.listActiveSessionDocumentLinks(session.id);
  const documents = [];
  const excluded = {
    inaccessible: 0,
    unavailable: 0,
    notReady: 0,
  };

  for (const link of links) {
    const docId = Number(link.doc_id);
    const document = await documentModel.findActiveById(docId);
    if (!document) {
      excluded.unavailable += 1;
      continue;
    }

    const authorized = await canUseDocumentThroughOwnedSession({
      document,
      session,
      userId,
    });

    if (!authorized) {
      excluded.inaccessible += 1;
      continue;
    }
    if (!isDocumentReadyForRag(document)) {
      excluded.notReady += 1;
      continue;
    }
    documents.push(document);
  }

  return { session, documents, excluded };
}

async function resolveAskScope({ id, sessionId, userId }) {
  if (sessionId !== undefined && sessionId !== null) {
    const resolved = await resolveAuthorizedSessionDocuments({ sessionId, userId });
    return { ...resolved, compatibilityDocument: null };
  }

  const doc = await getProcessableDocument({ id, userId });
  const session = await chatService.getOrCreateSession({ userId, docId: doc.id });
  return {
    session,
    documents: [doc],
    excluded: { inaccessible: 0, unavailable: 0, notReady: 0 },
    compatibilityDocument: doc,
  };
}

async function loadSessionChunks({ documents, sessionId, userId, sendEvent }) {
  const allChunks = [];
  const usableDocuments = [];
  const skippedDocumentIds = [];
  let autoProcessed = false;
  const existingChunks = await documentChunkModel.findByDocumentIds(
    documents.map((document) => document.id)
  );
  const chunksByDocument = new Map();
  for (const chunk of existingChunks) {
    const docChunks = chunksByDocument.get(Number(chunk.doc_id)) || [];
    docChunks.push(chunk);
    chunksByDocument.set(Number(chunk.doc_id), docChunks);
  }

  for (const doc of documents) {
    let chunks = chunksByDocument.get(Number(doc.id)) || [];
    const canAutoProcessDocument = doc.document_scope !== 'shared'
      && String(doc.user_id) === String(userId);

    if (!chunks.length && canAutoProcessDocument) {
      try {
        sendEvent?.('status', { message: `Preparing ${doc.title || 'document'} for AI...` });
        const result = await getOrCreateChunksForAsk({ doc, userId, sessionId, sendEvent });
        chunks = result.chunks;
        autoProcessed = autoProcessed || result.autoProcessed;
      } catch (err) {
        console.error(`Document ${doc.id} preparation failed:`, err.message);
      }
    }

    if (!chunks.length) {
      skippedDocumentIds.push(doc.id);
      continue;
    }

    usableDocuments.push(doc);
    allChunks.push(...chunks.map((chunk) => ({
      ...chunk,
      documentTitle: doc.title,
      metadata: {
        ...(chunk.metadata || {}),
        documentId: doc.id,
        documentTitle: doc.title,
      },
    })));
  }

  return { allChunks, usableDocuments, skippedDocumentIds, autoProcessed };
}

function buildScopeResponse({
  answer,
  sources,
  documents,
  compatibilityDocument,
  session,
  answerMode,
  usedRag,
  autoProcessed,
  provider,
  model,
  usage,
  userMessage,
  assistantMessage,
  excludedAttachments,
  comparisonMetadata = null,
  needsProcessing = false,
  processingError = null,
}) {
  return {
    answer,
    sources,
    documents: documents.map((doc) => ({ id: doc.id, title: doc.title })),
    ...(compatibilityDocument ? {
      document: { id: compatibilityDocument.id, title: compatibilityDocument.title },
    } : {}),
    sessionId: session.id,
    mode: answerMode,
    usedRag,
    autoProcessed,
    provider,
    model,
    usage,
    needsProcessing,
    processingError,
    excludedAttachments,
    comparison: comparisonMetadata,
    messages: {
      user: userMessage,
      assistant: assistantMessage,
    },
  };
}

async function prepareAsk({ id, sessionId, userId, question, mode, model, sendEvent }) {
  const cleanedQuestion = cleanQuestion(question);
  const answerMode = normalizeAnswerMode(mode);
  const selectedProviderModel = aiUsageService.resolveModel(model);
  const selectedModel = selectedProviderModel.model;
  const selectedProvider = selectedProviderModel.provider;
  sendEvent?.('status', { message: sessionId ? 'Checking session attachments...' : 'Checking document...' });
  const scope = await resolveAskScope({ id, sessionId, userId });
  const { session, compatibilityDocument, excluded } = scope;
  const storedHistory = await chatModel.getRecentMessages(
    session.id,
    chatContextService.MAX_HISTORY_MESSAGES
  );
  const requestContext = chatContextService.analyzeRequest({
    question: cleanedQuestion,
    history: storedHistory,
    documents: scope.documents,
  });
  requestContext.comparisonDebug = {
    resolvedActiveAttachmentIds: requestContext.activeAttachmentIds,
    inheritedComparedDocumentIds: requestContext.inheritedComparedDocumentIds,
    filteredComparedDocumentIds: requestContext.filteredComparedDocumentIds,
    finalRetrievalQuery: requestContext.retrievalQuery,
    selectedSourceDocumentIds: [],
    comparisonEvidenceStrategy: null,
  };
  const userMetadata = {
    intent: requestContext.intent,
    comparedDocumentIds: requestContext.comparedDocumentIds,
    substantiveQuestion: requestContext.substantiveQuestion,
    retrievalQuery: requestContext.retrievalQuery,
    responseConstraints: requestContext.responseConstraints,
    comparisonDebug: requestContext.comparisonDebug,
  };
  const userMessage = await chatModel.addMessage(
    session.id,
    'user',
    cleanedQuestion,
    userMetadata
  );

  if (requestContext.comparisonUnavailable) {
    const answer = chatContextService.buildComparisonUnavailableAnswer(cleanedQuestion);
    const comparisonMetadata = {
      strategy: 'active_attachment_scope',
      confidence: 'none',
      comparedDocumentIds: requestContext.filteredComparedDocumentIds,
      ...requestContext.comparisonDebug,
      comparisonEvidenceStrategy: 'active_attachment_scope',
    };
    requestContext.comparisonDebug = comparisonMetadata;
    const assistantMetadata = buildAssistantMetadata({
      provider: 'system',
      model: null,
      mode: answerMode,
      usedRag: false,
      requestContext,
      comparisonMetadata,
    });
    const assistantMessage = await chatModel.addMessage(
      session.id,
      'assistant',
      answer,
      assistantMetadata
    );
    await safeTouchSession(session.id);
    return {
      systemResponse: buildScopeResponse({
        answer,
        sources: [],
        documents: scope.documents,
        compatibilityDocument,
        session,
        answerMode,
        usedRag: false,
        autoProcessed: false,
        provider: 'system',
        model: null,
        usage: null,
        userMessage,
        assistantMessage,
        excludedAttachments: excluded,
        comparisonMetadata,
      }),
    };
  }

  const chunkResult = await loadSessionChunks({
    documents: scope.documents,
    sessionId: session.id,
    userId,
    sendEvent,
  });
  const excludedAttachments = {
    ...excluded,
    notIndexed: chunkResult.skippedDocumentIds.length,
  };

  if (!chunkResult.allChunks.length) {
    const answer = compatibilityDocument
      ? 'I could not prepare this document for AI automatically. Please make sure it is a readable document, then try asking again.'
      : 'I could not find any readable, indexed document content in this chat session.';
    const processingError = 'No usable document chunks are available';
    const assistantMetadata = buildAssistantMetadata({
      provider: 'system',
      model: null,
      mode: answerMode,
      usedRag: false,
      needsProcessing: true,
      processingError,
      requestContext,
    });
    const assistantMessage = await chatModel.addMessage(session.id, 'assistant', answer, assistantMetadata);
    await safeTouchSession(session.id);

    return {
      systemResponse: buildScopeResponse({
        answer,
        sources: [],
        documents: scope.documents,
        compatibilityDocument,
        session,
        answerMode,
        usedRag: false,
        autoProcessed: chunkResult.autoProcessed,
        provider: 'system',
        model: null,
        usage: null,
        userMessage,
        assistantMessage,
        excludedAttachments,
        needsProcessing: true,
        processingError,
        comparisonMetadata: null,
      }),
    };
  }

  sendEvent?.('status', { message: 'Searching relevant chunks...' });
  const comparisonDocuments = requestContext.intent === 'comparison'
    ? chunkResult.usableDocuments.filter((document) => (
      requestContext.comparedDocumentIds.includes(Number(document.id))
    ))
    : [];
  let relevantChunks;
  let comparisonMetadata = null;

  if (comparisonDocuments.length >= 2) {
    const comparison = await ragComparisonService.retrieveComparisonEvidence({
      question: requestContext.retrievalQuery,
      chunks: chunkResult.allChunks.filter((chunk) => (
        requestContext.comparedDocumentIds.includes(Number(chunk.doc_id || chunk.metadata?.documentId))
      )),
      documents: comparisonDocuments,
    });
    comparisonMetadata = comparison.metadata;
    comparisonMetadata = {
      ...comparisonMetadata,
      ...requestContext.comparisonDebug,
      comparisonEvidenceStrategy: comparison.metadata.strategy,
    };
    requestContext.comparisonDebug = comparisonMetadata;

    if (comparison.insufficient) {
      const answer = ragComparisonService.buildInsufficientEvidenceAnswer(cleanedQuestion);
      const assistantMetadata = buildAssistantMetadata({
        provider: 'system',
        model: null,
        mode: answerMode,
        usedRag: false,
        requestContext,
        comparisonMetadata,
      });
      const assistantMessage = await chatModel.addMessage(
        session.id,
        'assistant',
        answer,
        assistantMetadata
      );
      await safeTouchSession(session.id);
      return {
        systemResponse: buildScopeResponse({
          answer,
          sources: [],
          documents: comparisonDocuments,
          compatibilityDocument,
          session,
          answerMode,
          usedRag: false,
          autoProcessed: chunkResult.autoProcessed,
          provider: 'system',
          model: null,
          usage: null,
          userMessage,
          assistantMessage,
          excludedAttachments,
          comparisonMetadata,
        }),
      };
    }
    relevantChunks = comparison.chunks;
  } else {
    relevantChunks = await retrieveChunksForQuestion({
      docIds: chunkResult.usableDocuments.map((doc) => doc.id),
      question: requestContext.retrievalQuery,
      chunks: chunkResult.allChunks,
    });
  }

  if (!relevantChunks.length) {
    throw createError(400, 'No document context is available for this question');
  }

  const evidenceDocuments = comparisonDocuments.length >= 2
    ? comparisonDocuments
    : chunkResult.usableDocuments;
  const documentsById = new Map(evidenceDocuments.map((doc) => [Number(doc.id), doc]));
  const validatedEvidence = ragService.buildValidatedEvidence(relevantChunks, documentsById);
  logRagValidationDebug({
    sessionId: session.id,
    resolvedDocuments: evidenceDocuments,
    retrievedChunks: relevantChunks,
    validation: validatedEvidence.validation,
  });
  relevantChunks = validatedEvidence.chunks;
  const sources = validatedEvidence.sources;
  if (!relevantChunks.length) {
    throw createError(400, 'No ownership-valid document context is available for this question');
  }
  await documentModel.touchSessionDocuments(
    [...new Set(sources.map((source) => Number(source.documentId)).filter(Number.isInteger))]
  );
  const estimatedTokens = estimatePromptTokens({
    question: cleanedQuestion,
    chunks: relevantChunks,
    history: requestContext.history,
    documentTitles: evidenceDocuments.map((document) => document.title),
    responseConstraints: requestContext.responseConstraints,
  });
  if (selectedProvider === 'gemini') {
    await aiUsageService.assertQuota({ model: selectedModel, userId, estimatedTokens });
  }

  if (comparisonMetadata) {
    const selectedSourceDocumentIds = [...new Set(
      sources.map((source) => Number(source.documentId)).filter(Number.isInteger)
    )];
    const normalizedRetrievalTopic = chatContextService.normalizeComparable(
      requestContext.retrievalQuery
    );
    const databaseOnly = /\b(database|db|co so du lieu|persistence)\b/.test(normalizedRetrievalTopic);
    const groundedAnswer = ragComparisonService.buildGroundedProviderAnswer({
      claims: comparisonMetadata.allowedDifferenceClaims,
      databaseOnly,
      compact: requestContext.formattingOnly && requestContext.responseConstraints.brief,
    });
    comparisonMetadata = {
      ...comparisonMetadata,
      selectedSourceDocumentIds,
      sourceOwnershipValidation: validatedEvidence.validation,
      promptResponseConstraints: requestContext.responseConstraints,
      groundedAnswer,
      databaseOnly,
    };
    requestContext.comparisonDebug = comparisonMetadata;
    if (process.env.RAG_COMPARISON_DEBUG === 'true') {
      console.info('RAG source ownership validation:', validatedEvidence.validation);
      console.info('RAG prompt response constraints:', requestContext.responseConstraints);
    }
  }

  return {
    cleanedQuestion,
    answerMode,
    selectedProvider,
    selectedModel,
    documents: evidenceDocuments,
    compatibilityDocument,
    session,
    userMessage,
    relevantChunks,
    sources,
    autoProcessed: chunkResult.autoProcessed,
    excludedAttachments,
    requestContext,
    comparisonMetadata,
  };
}

async function executeAsk({ id, sessionId, userId, question, mode, model }) {
  const prepared = await prepareAsk({ id, sessionId, userId, question, mode, model });
  if (prepared.systemResponse) {
    return prepared.systemResponse;
  }

  const {
    cleanedQuestion,
    answerMode,
    selectedProvider,
    selectedModel,
    documents,
    compatibilityDocument,
    session,
    userMessage,
    relevantChunks,
    sources,
    autoProcessed,
    excludedAttachments,
    requestContext,
    comparisonMetadata,
  } = prepared;
  let generationResult;

  try {
    generationResult = await aiProviderService.generateAnswer({
      provider: selectedProvider,
      question: cleanedQuestion,
      documentTitle: compatibilityDocument?.title,
      documentTitles: documents.map((doc) => doc.title),
      chunks: relevantChunks,
      mode: answerMode,
      model: selectedModel,
      history: requestContext.history,
      responseConstraints: requestContext.responseConstraints,
      comparisonMetadata,
      substantiveQuestion: requestContext.substantiveQuestion,
      retrievalQuery: requestContext.retrievalQuery,
    });

    await aiUsageService.logGeminiRequest({
      userId,
      docId: compatibilityDocument?.id || null,
      sessionId: session.id,
      provider: selectedProvider,
      model: selectedModel,
      requestType: compatibilityDocument ? 'document_qa' : 'session_qa',
      promptTokens: generationResult.usageMetadata?.promptTokens,
      completionTokens: generationResult.usageMetadata?.completionTokens,
      totalTokens: generationResult.usageMetadata?.totalTokens,
      success: true,
    });
  } catch (err) {
    await aiUsageService.logGeminiRequest({
      userId,
      docId: compatibilityDocument?.id || null,
      sessionId: session.id,
      provider: selectedProvider,
      model: selectedModel,
      requestType: compatibilityDocument ? 'document_qa' : 'session_qa',
      success: false,
      errorCode: err.code || err.statusCode || err.name || 'gemini_error',
    });
    if (err.publicMessage) {
      throw err;
    }
    throw createError(503, 'AI service is temporarily unavailable. Please try again');
  }

  const answer = comparisonMetadata?.groundedAnswer
    || aiProviderService.sanitizeAnswerCitationAttribution(generationResult.answer);
  const assistantMessage = await saveAssistantAnswer({
    sessionId: session.id,
    answer,
    provider: selectedProvider,
    model: selectedModel,
    mode: answerMode,
    usedRag: true,
    sources,
    requestContext,
    comparisonMetadata,
  });
  const usage = await getUsageBestEffort({ model: selectedModel, userId });

  return buildScopeResponse({
    answer,
    sources,
    documents,
    compatibilityDocument,
    session,
    answerMode,
    usedRag: true,
    autoProcessed,
    provider: selectedProvider,
    model: selectedModel,
    usage,
    userMessage,
    assistantMessage,
    excludedAttachments,
    comparisonMetadata,
  });
}

async function executeAskStream({ id, sessionId, userId, question, mode, model, sendEvent }) {
  const prepared = await prepareAsk({ id, sessionId, userId, question, mode, model, sendEvent });
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
    documents,
    compatibilityDocument,
    session,
    userMessage,
    relevantChunks,
    sources,
    autoProcessed,
    excludedAttachments,
    requestContext,
    comparisonMetadata,
  } = prepared;

  let answer = '';
  let usageMetadata = null;
  sendEvent('status', { message: 'Generating answer...' });

  try {
    for await (const event of aiProviderService.streamAnswer({
      provider: selectedProvider,
      question: cleanedQuestion,
      documentTitle: compatibilityDocument?.title,
      documentTitles: documents.map((doc) => doc.title),
      chunks: relevantChunks,
      mode: answerMode,
      model: selectedModel,
      history: requestContext.history,
      responseConstraints: requestContext.responseConstraints,
      comparisonMetadata,
      substantiveQuestion: requestContext.substantiveQuestion,
      retrievalQuery: requestContext.retrievalQuery,
    })) {
      if (event.type === 'token' && event.text) {
        answer += event.text;
        if (!comparisonMetadata?.groundedAnswer) sendEvent('token', { text: event.text });
      } else if (event.type === 'usage') {
        usageMetadata = event.usageMetadata;
      }
    }

    await aiUsageService.logGeminiRequest({
      userId,
      docId: compatibilityDocument?.id || null,
      sessionId: session.id,
      provider: selectedProvider,
      model: selectedModel,
      requestType: compatibilityDocument ? 'document_qa' : 'session_qa',
      promptTokens: usageMetadata?.promptTokens,
      completionTokens: usageMetadata?.completionTokens,
      totalTokens: usageMetadata?.totalTokens,
      success: true,
    });
  } catch (err) {
    await aiUsageService.logGeminiRequest({
      userId,
      docId: compatibilityDocument?.id || null,
      sessionId: session.id,
      provider: selectedProvider,
      model: selectedModel,
      requestType: compatibilityDocument ? 'document_qa' : 'session_qa',
      success: false,
      errorCode: err.code || err.statusCode || err.name || 'stream_error',
    });
    throw err.publicMessage ? err : createError(503, 'AI service is temporarily unavailable. Please try again');
  }

  answer = comparisonMetadata?.groundedAnswer
    || aiProviderService.sanitizeAnswerCitationAttribution(answer);
  if (comparisonMetadata?.groundedAnswer) sendEvent('token', { text: answer });
  const assistantMessage = await saveAssistantAnswer({
    sessionId: session.id,
    answer,
    provider: selectedProvider,
    model: selectedModel,
    mode: answerMode,
    usedRag: true,
    sources,
    requestContext,
    comparisonMetadata,
  });
  const usage = await getUsageBestEffort({ model: selectedModel, userId });

  sendEvent('done', buildScopeResponse({
    answer,
    sources,
    documents,
    compatibilityDocument,
    session,
    answerMode,
    usedRag: true,
    autoProcessed,
    provider: selectedProvider,
    model: selectedModel,
    usage,
    userMessage,
    assistantMessage,
    excludedAttachments,
    comparisonMetadata,
  }));
}

async function askDocument(args) {
  return executeAsk(args);
}

async function askSession(args) {
  return executeAsk(args);
}

async function askDocumentStream(args) {
  return executeAskStream(args);
}

async function askSessionStream(args) {
  return executeAskStream(args);
}

module.exports = {
  processDocument,
  askDocument,
  askDocumentStream,
  askSession,
  askSessionStream,
};
