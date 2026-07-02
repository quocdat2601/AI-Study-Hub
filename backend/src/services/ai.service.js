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
const ragNeighborService = require('./rag-neighbor.service');
const ragRerankService = require('./rag-rerank.service');
const chatContextService = require('./chat-context.service');
const documentOverviewModel = require('../models/document-overview.model');
const documentOverviewService = require('./document-overview.service');
const documentRoadmapModel = require('../models/document-roadmap.model');
const documentRoadmapProgressModel = require('../models/document-roadmap-progress.model');
const documentRoadmapService = require('./document-roadmap.service');
const { getDocumentOverviewConfig } = require('../config/document-overview');
const supabaseService = require('./supabase.service');
const createError = require('../utils/createError');

const MAX_QUESTION_CHARS = 2000;
const ANSWER_MODES = new Set(['hybrid', 'document_only']);
const RAG_CONTEXT_LIMIT = 4;
const OVERVIEW_CONTEXT_LIMIT = ragService.MAX_CONTEXT_CHARS;
const EXPLICIT_SCOPE_CANDIDATE_LIMIT = 6;
const GENERAL_SCOPE_CANDIDATE_LIMIT = 12;
const VECTOR_SCORE_WEIGHT = 0.7;
const KEYWORD_SCORE_WEIGHT = 0.3;
const IMAGE_OCR_LIMITATION_ANSWER = 'Tôi chưa đọc được nội dung chữ từ hình ảnh này. Hiện hệ thống chỉ hỗ trợ OCR văn bản trong ảnh và chưa thể phân tích vật thể hoặc nội dung hình ảnh không có chữ.';

function logImageOcrDebug(label, payload = {}) {
  if (process.env.NODE_ENV === 'production') return;
  console.info(`[image-ocr-debug] ${label}`, payload);
}

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

function resolveStoredUserMessageContent({ question, displayQuestion }) {
  const display = String(displayQuestion || '').trim();
  if (display) return chatContextService.stripStudioMetaFromDisplay(display);
  return chatContextService.stripStudioMetaFromDisplay(question);
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

function isImageDocument(doc) {
  return chatContextService.isImageDocument(doc);
}

function isOcrTextImageQuestion(type) {
  return [
    'image_text_question',
    'image_text_transcription',
    'image_question_answering',
    'image_multiple_choice_question',
    'image_summary',
  ].includes(type);
}

function detectMultipleChoiceFromOcrChunks(chunks = []) {
  const text = chunks
    .map((chunk) => String(chunk.promptContent || chunk.content || ''))
    .join('\n')
    .slice(0, 6000);
  const optionMatches = text.match(/(?:^|\n|\s)(?:[A-D][).:]|[1-4][).:])\s+\S+/giu) || [];
  const hasQuestionMark = /[?？]|(?:cau hoi|question|chon|choose|select|dap an|answer)/iu.test(
    chatContextService.normalizeComparable(text)
  );
  return hasQuestionMark && optionMatches.length >= 2;
}

function estimatePromptTokens({
  question,
  chunks,
  history,
  documentTitles,
  responseConstraints,
  overviewContext,
}) {
  const chars = String(question || '').length
    + (chunks || []).reduce((total, chunk) => (
      total + String(chunk.promptContent || chunk.content || '').length
    ), 0)
    + (history || []).reduce((total, message) => total + String(message.content || '').length, 0)
    + (documentTitles || []).join(' ').length
    + JSON.stringify(responseConstraints || {}).length
    + String(overviewContext || '').length;
  return Math.ceil(chars / 4);
}

async function extractTextFromStorage(doc) {
  const storagePath = doc.cloud_files?.storage_path;
  const mimeType = getMimeType(doc);

  if (!storagePath) {
    throw createError(404, 'Document file not found');
  }

  const canExtractFromStorage = mimeType === documentTextService.MIME_TYPES.PDF
    || mimeType === documentTextService.MIME_TYPES.DOCX
    || mimeType === documentTextService.MIME_TYPES.TXT
    || documentTextService.IMAGE_MIME_TYPES.has(mimeType);

  if (!canExtractFromStorage) {
    throw createError(400, 'This document type cannot be processed for AI');
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

  if (!force) {
    const existingChunks = await documentChunkModel.findByDocumentId(doc.id);
    if (
      existingChunks.length
      && extractionStatus === 'ready'
      && documentTextService.isExtractedTextUseful(existingText)
    ) {
      return {
        document: savedDoc,
        chunkCount: existingChunks.length,
        status: 'ready',
        overviewStatus: null,
        alreadyProcessed: true,
      };
    }
  }

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

  await documentOverviewService.markStaleBestEffort(doc.id);
  await documentRoadmapService.markStaleBestEffort(doc.id);
  const savedChunks = await documentChunkModel.replaceForDocument(doc.id, chunksToSave);
  const overview = await documentOverviewService.generateOverviewBestEffort({
    document: savedDoc,
    chunks: savedChunks,
  });
  const roadmap = await documentRoadmapService.generateRoadmapBestEffort({
    document: savedDoc,
    chunks: savedChunks,
  });

  return {
    document: savedDoc,
    chunkCount: savedChunks.length,
    status: 'ready',
    overviewStatus: overview?.status || null,
    roadmapStatus: roadmap?.status || null,
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
      imageQuestionType: requestContext.imageQuestionType || null,
      inheritedImageTask: requestContext.inheritedImageTask || null,
    } : {}),
    ...(comparisonMetadata ? { comparison: comparisonMetadata } : {}),
  };
}

function buildAmbiguousDocumentAnswer(question, matches = []) {
  const vietnamese = /[\u00C0-\u1EF9]|\b(file|tai lieu|tep)\b/iu.test(String(question || ''));
  const titles = (matches || [])
    .map((document) => document.title)
    .filter(Boolean)
    .slice(0, 4)
    .map((title) => `- ${title}`)
    .join('\n');
  return vietnamese
    ? `Mình chưa chắc bạn muốn hỏi tài liệu nào. Vui lòng chọn rõ một trong các tài liệu sau:\n${titles}`
    : `I am not sure which document you mean. Please ask using one specific document name:\n${titles}`;
}

function buildImageOcrLimitationAnswer(question) {
  const normalized = chatContextService.normalizeComparable(question);
  const likelyVietnamese = /\b(anh|hinh|hinh anh|vua gui|trong)\b/iu.test(normalized);
  return likelyVietnamese
    ? IMAGE_OCR_LIMITATION_ANSWER
    : 'I could not read text from this image yet. This system currently supports OCR text in images, but it cannot analyze objects, layout, diagrams, screenshots, or non-text visual content.';
}

function buildImageVisualLimitationAnswer(question) {
  const normalized = chatContextService.normalizeComparable(question);
  const likelyVietnamese = /\b(anh|hinh|bo cuc|bieu do|vat|trong)\b/iu.test(normalized);
  return likelyVietnamese
    ? 'Hiện hệ thống chưa hỗ trợ phân tích trực quan hình ảnh như vật thể, bố cục, biểu đồ hoặc nội dung không có chữ. Mình chỉ có thể trả lời dựa trên văn bản OCR đọc được trong ảnh.'
    : 'Visual image understanding is not implemented yet. I can only answer from OCR text extracted from the image, not objects, layout, charts, diagrams, or non-text visual content.';
}

async function saveSystemAskResponse({
  answer,
  answerMode,
  autoProcessed = false,
  compatibilityDocument,
  documents,
  excludedAttachments,
  model = null,
  needsProcessing = false,
  processingError = null,
  provider = 'system',
  requestContext,
  session,
  userMessage,
}) {
  const assistantMetadata = buildAssistantMetadata({
    provider,
    model,
    mode: answerMode,
    usedRag: false,
    needsProcessing,
    processingError,
    requestContext,
  });
  const assistantMessage = await chatModel.addMessage(session.id, 'assistant', answer, assistantMetadata);
  await safeTouchSession(session.id);
  return {
    systemResponse: buildScopeResponse({
      answer,
      sources: [],
      documents,
      compatibilityDocument,
      session,
      answerMode,
      usedRag: false,
      autoProcessed,
      provider,
      model,
      usage: null,
      userMessage,
      assistantMessage,
      excludedAttachments,
      needsProcessing,
      processingError,
      comparisonMetadata: null,
    }),
  };
}

function filterDocumentsByIds(documents, documentIds) {
  const allowedIds = new Set((documentIds || []).map(Number).filter(Number.isInteger));
  if (!allowedIds.size) return [];
  return (documents || []).filter((document) => allowedIds.has(Number(document.id)));
}

function filterChunksByDocumentIds(chunks, documentIds) {
  const allowedIds = new Set((documentIds || []).map(Number).filter(Number.isInteger));
  if (!allowedIds.size) return [];
  return (chunks || []).filter((chunk) => {
    const id = Number(chunk.doc_id || chunk.metadata?.documentId);
    return allowedIds.has(id);
  });
}

function detectOverviewIntent({ question, requestContext, documentScope }) {
  const normalized = chatContextService.normalizeComparable(question);
  const overviewPattern = /\b(what is .* (file|document).* about|what .* (file|document).* say|summari[sz]e|summary|main purpose|key points|main idea|overview)\b|noi dung chinh|tom tat|noi ve gi|file nay noi|tai lieu nay noi|tep nay noi/iu;
  const comparisonOverviewPattern = /\b(compare|comparison|related|relationship|relation|similarities|differences|both files|these two documents|both attached documents|the two attachments)\b|so sanh|lien quan|khac nhau|hai file|hai tai lieu|2 file|2 tai lieu|ca hai file|hai file doc/iu;
  const narrowFactualPattern = /\b(deadline|due date|invoice number|amount|price|cost|email|phone|address|date|who|when|where|how many|which requirement|status of|id)\b|ngay nao|bao nhieu|ai la|o dau|ma so|han nop/iu;

  if (requestContext.intent === 'comparison' && comparisonOverviewPattern.test(normalized)) {
    return documentScope.documentIds?.length >= 2 ? 'document_comparison_overview' : null;
  }

  if (overviewPattern.test(normalized) && !narrowFactualPattern.test(normalized)) {
    return documentScope.type === 'explicit_single' || documentScope.documentIds?.length === 1
      ? 'document_overview'
      : null;
  }

  return null;
}

function trimForOverviewContext(text, limit) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function formatOverviewRecord({ document, overview, chunkCount, charLimit }) {
  const topics = Array.isArray(overview.key_topics) ? overview.key_topics.join(', ') : '';
  const outline = Array.isArray(overview.outline)
    ? overview.outline
      .map((item) => {
        const heading = item.heading || item.title || item.section || 'Section';
        const description = item.description || item.summary || '';
        return `- ${heading}${description ? `: ${description}` : ''}`;
      })
      .join('\n')
    : '';
  return trimForOverviewContext([
    `Document: ${document.title || `Document ${document.id}`}`,
    `Type: ${overview.document_type || 'Unknown'}`,
    `Purpose: ${overview.purpose || 'Unknown'}`,
    `Summary: ${overview.summary || ''}`,
    topics ? `Key topics: ${topics}` : '',
    outline ? `Outline:\n${outline}` : '',
    `Supporting source chunks included: ${chunkCount}`,
  ].filter(Boolean).join('\n'), charLimit);
}

async function buildOverviewEvidence({ documents, overviewIntent }) {
  const runtimeConfig = getDocumentOverviewConfig();
  const docIds = (documents || []).map((doc) => Number(doc.id)).filter(Number.isInteger);
  if (!docIds.length) return null;

  const overviews = await documentOverviewModel.findReadyByDocumentIds(
    docIds,
    runtimeConfig.overviewVersion
  );
  const overviewByDocId = new Map(overviews.map((overview) => [Number(overview.document_id), overview]));
  // If any document in scope lacks a ready overview, return null so the caller
  // falls through to chunk-based comparison for ALL resolved documents.  Do NOT
  // remove a document from scope or report "only one document attached".
  if (docIds.some((docId) => !overviewByDocId.has(docId))) return null;

  const allSourceIds = overviews
    .flatMap((overview) => overview.source_chunk_ids || [])
    .map(Number)
    .filter(Number.isInteger);
  // An overview with no source chunk IDs is unusable; fall through to chunks.
  if (!allSourceIds.length) return null;

  const sourceChunks = await documentChunkModel.findByIds(allSourceIds);
  const chunksByDocId = new Map();
  for (const chunk of sourceChunks) {
    const docId = Number(chunk.doc_id);
    if (!docIds.includes(docId)) continue;
    const docChunks = chunksByDocId.get(docId) || [];
    docChunks.push(chunk);
    chunksByDocId.set(docId, docChunks);
  }

  const maxChunksPerDocument = overviewIntent === 'document_comparison_overview' ? 2 : 2;
  const selectedChunks = [];
  let remainingContext = OVERVIEW_CONTEXT_LIMIT;
  const perDocumentContextLimit = Math.max(800, Math.floor(OVERVIEW_CONTEXT_LIMIT / docIds.length));
  const overviewParts = [];

  for (const document of documents) {
    const docId = Number(document.id);
    const overview = overviewByDocId.get(docId);
    const docChunks = (chunksByDocId.get(docId) || [])
      .sort((a, b) => Number(a.chunk_index || 0) - Number(b.chunk_index || 0))
      .slice(0, maxChunksPerDocument)
      .map((chunk) => ({
        ...chunk,
        documentTitle: document.title,
        score: Number(chunk.score || 1),
        metadata: {
          ...(chunk.metadata || {}),
          documentId: docId,
          documentTitle: document.title,
          retrieval: 'document_overview',
        },
      }));
    // If the source chunks for any document are missing, fall through to chunks.
    if (!docChunks.length) return null;
    selectedChunks.push(...docChunks);

    const part = formatOverviewRecord({
      document,
      overview,
      chunkCount: docChunks.length,
      charLimit: Math.min(remainingContext, perDocumentContextLimit),
    });
    if (part) {
      overviewParts.push(part);
      remainingContext -= part.length;
    }
  }

  const chunkBudget = Math.max(1200, OVERVIEW_CONTEXT_LIMIT - overviewParts.join('\n\n---\n\n').length);
  const chunkLimit = Math.max(300, Math.floor(chunkBudget / Math.max(selectedChunks.length, 1)));
  const boundedChunks = selectedChunks.map((chunk) => ({
    ...chunk,
    promptContent: trimForOverviewContext(chunk.content, chunkLimit),
  }));

  return {
    overviewContext: overviewParts.join('\n\n---\n\n').slice(0, OVERVIEW_CONTEXT_LIMIT),
    chunks: boundedChunks,
    metadata: {
      overviewIntent,
      overviewDocumentIds: docIds,
      overviewVersion: runtimeConfig.overviewVersion,
    },
  };
}

function candidateLimitForScope(scopeType) {
  return scopeType === 'general' ? GENERAL_SCOPE_CANDIDATE_LIMIT : EXPLICIT_SCOPE_CANDIDATE_LIMIT;
}

async function retrieveChunksForQuestion({
  docIds,
  question,
  chunks,
  scopeType = 'general',
}) {
  const candidateLimit = candidateLimitForScope(scopeType);
  const keywordChunks = ragService.retrieveRelevantChunks(question, chunks, candidateLimit);

  const apiKey = String(process.env.GEMINI_API_KEY || '');
  const embeddingsAvailable = apiKey && !/replace_with|placeholder|your_/i.test(apiKey);

  if (embeddingsAvailable) {
    try {
      const queryEmbedding = await embeddingService.embedQuery(question);
      const vectorRows = docIds.length === 1
        ? await documentChunkModel.matchByEmbedding({
          docId: docIds[0],
          embedding: queryEmbedding.embedding,
          limit: candidateLimit,
        })
        : await documentChunkModel.matchByEmbeddingAcrossDocuments({
          docIds,
          embedding: queryEmbedding.embedding,
          limit: candidateLimit,
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
      const errMsg = String(err.message || '');
      if (!errMsg.includes('API key')) {
        console.warn('Vector retrieval failed, falling back to keyword retrieval:', errMsg.slice(0, 200));
      }
    }
  }

  return keywordChunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...(chunk.metadata || {}),
      retrieval: 'keyword',
    },
  }));
}

function allocateDocumentCoverage(candidatesByDocument, documentIds, limit = RAG_CONTEXT_LIMIT) {
  const selected = [];
  const seen = new Set();
  const orderedIds = (documentIds || []).map(Number).filter(Number.isInteger);
  const maxPerDocument = orderedIds.length <= 2 ? 2 : 1;

  for (const docId of orderedIds) {
    const candidates = candidatesByDocument.get(docId) || [];
    let taken = 0;
    for (const chunk of candidates) {
      if (taken >= maxPerDocument || selected.length >= limit) break;
      const key = getChunkKey(chunk);
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(chunk);
      taken += 1;
    }
  }

  const remaining = [...candidatesByDocument.values()]
    .flat()
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  for (const chunk of remaining) {
    if (selected.length >= limit) break;
    const key = getChunkKey(chunk);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(chunk);
  }

  return selected
    .sort((a, b) => orderedIds.indexOf(Number(a.doc_id || a.metadata?.documentId))
      - orderedIds.indexOf(Number(b.doc_id || b.metadata?.documentId))
      || Number(a.chunk_index || 0) - Number(b.chunk_index || 0));
}

async function retrieveCoveredChunksForQuestion({ docIds, question, chunks }) {
  const candidatesByDocument = new Map();
  for (const docId of docIds.map(Number).filter(Number.isInteger)) {
    const docChunks = filterChunksByDocumentIds(chunks, [docId]);
    if (!docChunks.length) {
      candidatesByDocument.set(docId, []);
      continue;
    }
    const candidates = await retrieveChunksForQuestion({
      docIds: [docId],
      question,
      chunks: docChunks,
      scopeType: 'explicit_single',
    });
    candidatesByDocument.set(docId, candidates);
  }
  return allocateDocumentCoverage(candidatesByDocument, docIds);
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
  const extractionReady = doc.extraction_status === 'ready'
    || doc.status === 'indexed'
    || doc.indexing_status === 'ready';
  if (!extractionReady) return false;
  if (doc.document_scope === 'shared') return true;
  return documentTextService.isExtractedTextUseful(doc.extracted_text);
}

function canAutoProcessDocumentForUser(doc, userId) {
  return doc?.document_scope !== 'shared'
    && (
      String(doc?.user_id) === String(userId)
      || (doc?.document_scope === 'library' && doc?.is_public === true)
    );
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
    notReadyIds: [],
    notReadyDocuments: [],
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
    const attachmentOrder = link.added_at || link.created_at || link.updated_at || null;
    const documentWithSessionLink = {
      ...document,
      session_link_added_at: attachmentOrder,
      session_link_id: link.id || null,
    };

    if (!isDocumentReadyForRag(documentWithSessionLink) && !canAutoProcessDocumentForUser(documentWithSessionLink, userId)) {
      excluded.notReady += 1;
      excluded.notReadyIds.push(documentWithSessionLink.id);
      excluded.notReadyDocuments.push(documentWithSessionLink);
      continue;
    }
    documents.push(documentWithSessionLink);
  }

  return { session, documents, excluded };
}

async function resolveAskScope({ primaryDocumentId, sessionId, userId }) {
  if (sessionId !== undefined && sessionId !== null) {
    const resolved = await resolveAuthorizedSessionDocuments({ sessionId, userId });
    return { ...resolved, compatibilityDocument: null };
  }

  const doc = await getProcessableDocument({ id: primaryDocumentId, userId });
  const session = await chatService.getOrCreateSession({ userId, docId: doc.id });
  return {
    session,
    documents: [doc],
    excluded: { inaccessible: 0, unavailable: 0, notReady: 0, notReadyIds: [] },
    compatibilityDocument: doc,
  };
}

async function loadSessionChunks({
  documents,
  sessionId,
  userId,
  sendEvent,
  allowAutoProcess = true,
}) {
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
    const canAutoProcessDocument = canAutoProcessDocumentForUser(doc, userId);

    if (!chunks.length && allowAutoProcess && canAutoProcessDocument) {
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
  const safeExcludedAttachments = excludedAttachments
    ? {
      ...excludedAttachments,
      notReadyDocuments: undefined,
    }
    : excludedAttachments;
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
    excludedAttachments: safeExcludedAttachments,
    comparison: comparisonMetadata,
    messages: {
      user: userMessage,
      assistant: assistantMessage,
    },
  };
}

async function prepareAsk({ primaryDocumentId, sessionId, userId, question, displayQuestion, mode, model, focusedDocumentId, sendEvent }) {
  const cleanedQuestion = cleanQuestion(question);
  const storedUserContent = resolveStoredUserMessageContent({ question: cleanedQuestion, displayQuestion });
  const answerMode = normalizeAnswerMode(mode);
  const selectedProviderModel = aiUsageService.resolveModel(model);
  const selectedModel = selectedProviderModel.model;
  const selectedProvider = selectedProviderModel.provider;
  sendEvent?.('status', { message: sessionId ? 'Checking session attachments...' : 'Checking document...' });
  const scope = await resolveAskScope({ primaryDocumentId, sessionId, userId });
  const { session, compatibilityDocument, excluded } = scope;
  const allScopeDocuments = [
    ...scope.documents,
    ...(excluded?.notReadyDocuments || []),
  ].filter((document, index, documents) => (
    documents.findIndex((candidate) => Number(candidate.id) === Number(document.id)) === index
  ));
  const storedHistory = await chatModel.getRecentMessages(
    session.id,
    chatContextService.MAX_HISTORY_MESSAGES
  );
  const inheritedImageTask = chatContextService.findInheritedImageTask(storedHistory, cleanedQuestion);
  const requestContext = chatContextService.analyzeRequest({
    question: cleanedQuestion,
    history: storedHistory,
    documents: allScopeDocuments,
  });
  const documentScope = chatContextService.resolveDocumentScope({
    question: requestContext.retrievalQuery,
    documents: allScopeDocuments,
    primaryDocumentId: session.primary_document_id || compatibilityDocument?.id || scope.documents[0]?.id,
    focusedDocumentId,
    intent: requestContext.intent,
  });
  if (
    requestContext.intent === 'comparison'
    && documentScope.reason === 'comparison_all_documents'
    && requestContext.comparedDocumentIds.length >= 2
  ) {
    documentScope.documentIds = requestContext.comparedDocumentIds;
    documentScope.reason = 'inherited_comparison_scope';
  }
  let imageQuestionType = chatContextService.classifyImageQuestion(cleanedQuestion)
    || inheritedImageTask?.imageQuestionType
    || null;
  if (inheritedImageTask?.substantiveQuestion && imageQuestionType) {
    requestContext.substantiveQuestion = `${inheritedImageTask.substantiveQuestion}\nClarification: ${cleanedQuestion}`;
    requestContext.retrievalQuery = inheritedImageTask.retrievalQuery || inheritedImageTask.substantiveQuestion;
    requestContext.responseConstraints = {
      ...(inheritedImageTask.responseConstraints || {}),
      ...(requestContext.responseConstraints || {}),
    };
    requestContext.inheritedImageTask = {
      imageQuestionType,
      substantiveQuestion: inheritedImageTask.substantiveQuestion,
    };
  }
  logImageOcrDebug('scope', {
    imageQuestionType,
    inheritedImageTask: Boolean(inheritedImageTask),
    documentScopeType: documentScope.type,
    documentScopeReason: documentScope.reason,
    documentIds: documentScope.documentIds,
    focusedDocumentId: focusedDocumentId == null ? null : Number(focusedDocumentId),
  });
  requestContext.documentScope = documentScope;
  if (requestContext.intent === 'comparison') {
    requestContext.comparedDocumentIds = documentScope.documentIds;
    requestContext.filteredComparedDocumentIds = documentScope.documentIds;
    requestContext.comparisonUnavailable = documentScope.documentIds.length < 2;
  }
  requestContext.comparisonDebug = {
    resolvedActiveAttachmentIds: requestContext.activeAttachmentIds,
    inheritedComparedDocumentIds: requestContext.inheritedComparedDocumentIds,
    filteredComparedDocumentIds: requestContext.filteredComparedDocumentIds,
    finalRetrievalQuery: requestContext.retrievalQuery,
    documentScope,
    selectedSourceDocumentIds: [],
    comparisonEvidenceStrategy: null,
  };
  const userMetadata = {
    intent: requestContext.intent,
    comparedDocumentIds: requestContext.comparedDocumentIds,
    substantiveQuestion: requestContext.substantiveQuestion,
    retrievalQuery: requestContext.retrievalQuery,
    responseConstraints: requestContext.responseConstraints,
    documentScope,
    comparisonDebug: requestContext.comparisonDebug,
    imageQuestionType,
  };
  const userMessage = await chatModel.addMessage(
    session.id,
    'user',
    storedUserContent,
    userMetadata
  );

  const notReadyTargets = filterDocumentsByIds(excluded?.notReadyDocuments || [], documentScope.documentIds);
  const targetedImage = documentScope.type === 'explicit_single'
    ? notReadyTargets.find(isImageDocument)
    : null;
  if (targetedImage) {
    const isProcessing = targetedImage.extraction_status === 'pending'
      || targetedImage.extraction_status === 'processing';
    const answer = isProcessing
      ? 'Tài liệu này hiện vẫn đang được xử lý hoặc chưa thể phân tích lúc này. Vui lòng thử lại sau vài giây.'
      : buildImageOcrLimitationAnswer(cleanedQuestion);
    const processingError = isProcessing
      ? 'Document is still processing'
      : (targetedImage.extraction_error || 'No readable text could be extracted from this image');
    logImageOcrDebug('not-ready-image', {
      imageQuestionType,
      documentId: Number(targetedImage.id),
      extractionStatus: targetedImage.extraction_status || null,
      isProcessing,
      processingError,
    });
    return saveSystemAskResponse({
      answer,
      answerMode,
      compatibilityDocument,
      documents: [targetedImage],
      excludedAttachments: excluded,
      needsProcessing: isProcessing,
      processingError,
      requestContext,
      session,
      userMessage,
    });
  }

  if (focusedDocumentId && excluded?.notReadyIds?.includes(Number(focusedDocumentId))) {
    const answer = 'Tài liệu này hiện vẫn đang được xử lý hoặc chưa thể phân tích lúc này. Vui lòng thử lại sau vài giây.';
    return saveSystemAskResponse({
      answer,
      answerMode,
      compatibilityDocument,
      documents: scope.documents,
      excludedAttachments: excluded,
      needsProcessing: true,
      processingError: 'Document is still processing',
      requestContext,
      session,
      userMessage,
    });
  }

  if (documentScope.type === 'ambiguous') {
    const answer = buildAmbiguousDocumentAnswer(cleanedQuestion, documentScope.matchingDocuments);
    const assistantMetadata = buildAssistantMetadata({
      provider: 'system',
      model: null,
      mode: answerMode,
      usedRag: false,
      requestContext,
    });
    const assistantMessage = await chatModel.addMessage(session.id, 'assistant', answer, assistantMetadata);
    await safeTouchSession(session.id);
    return {
      systemResponse: buildScopeResponse({
        answer,
        sources: [],
        documents: documentScope.matchingDocuments,
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
        comparisonMetadata: null,
      }),
    };
  }

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

  const documentsForRetrievalScope = documentScope.type === 'general'
    ? scope.documents
    : filterDocumentsByIds(scope.documents, documentScope.documentIds);
  const readyTargetedImage = documentScope.type === 'explicit_single'
    ? documentsForRetrievalScope.find(isImageDocument)
    : null;
  if (readyTargetedImage && imageQuestionType === 'image_visual_question') {
    logImageOcrDebug('visual-limitation', {
      imageQuestionType,
      documentId: Number(readyTargetedImage.id),
      extractionStatus: readyTargetedImage.extraction_status || null,
    });
    return saveSystemAskResponse({
      answer: buildImageVisualLimitationAnswer(cleanedQuestion),
      answerMode,
      compatibilityDocument,
      documents: [readyTargetedImage],
      excludedAttachments: excluded,
      processingError: 'Visual image understanding is not implemented',
      requestContext,
      session,
      userMessage,
    });
  }
  if (readyTargetedImage && isOcrTextImageQuestion(imageQuestionType)) {
    requestContext.imageQuestionType = imageQuestionType;
    logImageOcrDebug('ready-image-text', {
      imageQuestionType,
      documentId: Number(readyTargetedImage.id),
      extractionStatus: readyTargetedImage.extraction_status || null,
    });
  }
  const overviewIntent = detectOverviewIntent({
    question: cleanedQuestion,
    requestContext,
    documentScope,
  });

  if (overviewIntent && documentsForRetrievalScope.length) {
    const overviewEvidence = await buildOverviewEvidence({
      documents: documentsForRetrievalScope,
      overviewIntent,
    }).catch((err) => {
      console.warn('Document overview retrieval skipped:', err.message);
      return null;
    });

    if (overviewEvidence?.chunks?.length) {
      const documentsById = new Map(documentsForRetrievalScope.map((doc) => [Number(doc.id), doc]));
      const validatedEvidence = ragService.buildValidatedEvidence(overviewEvidence.chunks, documentsById);
      logRagValidationDebug({
        sessionId: session.id,
        resolvedDocuments: documentsForRetrievalScope,
        retrievedChunks: overviewEvidence.chunks,
        validation: validatedEvidence.validation,
      });

      if (validatedEvidence.chunks.length) {
        const sources = validatedEvidence.sources;
        await documentModel.touchSessionDocuments(
          [...new Set(sources.map((source) => Number(source.documentId)).filter(Number.isInteger))]
        );
        const estimatedTokens = estimatePromptTokens({
          question: cleanedQuestion,
          chunks: validatedEvidence.chunks,
          history: requestContext.history,
          documentTitles: documentsForRetrievalScope.map((document) => document.title),
          responseConstraints: requestContext.responseConstraints,
          overviewContext: overviewEvidence.overviewContext,
        });
        if (selectedProvider === 'gemini') {
          await aiUsageService.assertQuota({ model: selectedModel, userId, estimatedTokens });
        }
        requestContext.comparisonDebug = {
          ...(requestContext.comparisonDebug || {}),
          selectedSourceDocumentIds: [...new Set(sources.map((source) => Number(source.documentId)))],
          overviewIntent,
          overviewVersion: overviewEvidence.metadata.overviewVersion,
        };
        return {
          cleanedQuestion,
          answerMode,
          selectedProvider,
          selectedModel,
          documents: documentsForRetrievalScope,
          compatibilityDocument,
          session,
          userMessage,
          relevantChunks: validatedEvidence.chunks,
          sources,
          autoProcessed: false,
          excludedAttachments: excluded,
          requestContext,
          comparisonMetadata: null,
          overviewContext: overviewEvidence.overviewContext,
          overviewIntent,
        };
      }
    }
  }

  const chunkResult = await loadSessionChunks({
    documents: documentsForRetrievalScope,
    sessionId: session.id,
    userId,
    sendEvent,
    allowAutoProcess: true,
  });
  const excludedAttachments = {
    ...excluded,
    notIndexed: chunkResult.skippedDocumentIds.length,
  };

  if (readyTargetedImage && isOcrTextImageQuestion(requestContext.imageQuestionType)) {
    const targetedChunks = chunkResult.allChunks.filter((chunk) => (
      Number(chunk.doc_id || chunk.metadata?.documentId) === Number(readyTargetedImage.id)
    ));
    if (!targetedChunks.length) {
      return saveSystemAskResponse({
        answer: buildImageOcrLimitationAnswer(cleanedQuestion),
        answerMode,
        compatibilityDocument,
        documents: [readyTargetedImage],
        excludedAttachments,
        processingError: 'No readable OCR chunks are available for this image',
        requestContext,
        session,
        userMessage,
      });
    }
  }

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
        documents: documentsForRetrievalScope,
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
  const selectedScopeDocumentIds = documentScope.type === 'general'
    ? chunkResult.usableDocuments.map((document) => Number(document.id))
    : documentScope.documentIds;
  const scopedUsableDocuments = filterDocumentsByIds(
    chunkResult.usableDocuments,
    selectedScopeDocumentIds
  );
  const scopedChunks = filterChunksByDocumentIds(
    chunkResult.allChunks,
    selectedScopeDocumentIds
  );
  const comparisonDocuments = requestContext.intent === 'comparison'
    ? scopedUsableDocuments.filter((document) => (
      requestContext.comparedDocumentIds.includes(Number(document.id))
    ))
    : [];
  let relevantChunks;
  let comparisonMetadata = null;

  if (comparisonDocuments.length >= 2) {
    const comparison = await ragComparisonService.retrieveComparisonEvidence({
      question: requestContext.retrievalQuery,
      chunks: scopedChunks.filter((chunk) => (
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
    relevantChunks = documentScope.type === 'explicit_multi'
      ? await retrieveCoveredChunksForQuestion({
        docIds: scopedUsableDocuments.map((doc) => doc.id),
        question: requestContext.retrievalQuery,
        chunks: scopedChunks,
      })
      : await retrieveChunksForQuestion({
        docIds: scopedUsableDocuments.map((doc) => doc.id),
        question: requestContext.retrievalQuery,
        chunks: scopedChunks,
        scopeType: documentScope.type,
      });
    // Bounded neighbor expansion: optionally include one previous/next chunk
    // per seed from the pre-loaded pool to give the model fuller context.
    // Applied only to normal (non-comparison, non-overview) retrieval.
    // Falls back silently to original seeds on any error.
    relevantChunks = ragNeighborService.expandWithNeighborsSafe({
      seedChunks: relevantChunks,
      chunkPool: scopedChunks,
      question: requestContext.retrievalQuery,
      documentIds: selectedScopeDocumentIds,
    });
    // Rule-based reranking and pruning: re-score seeds + neighbors together,
    // apply intent-sensitive penalties, and drop low-relevance evidence.
    // Applied only to normal (non-comparison, non-overview) retrieval.
    // Falls back silently to the expanded list on any error.
    relevantChunks = ragRerankService.rerankAndPruneSafe({
      chunks: relevantChunks,
      question: requestContext.retrievalQuery,
      scopeType: documentScope.type,
      documentIds: selectedScopeDocumentIds,
    });
  }

  if (!relevantChunks.length) {
    throw createError(400, 'No document context is available for this question');
  }

  const evidenceDocuments = comparisonDocuments.length >= 2
    ? comparisonDocuments
    : scopedUsableDocuments;
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
  if (
    requestContext.imageQuestionType === 'image_question_answering'
    && detectMultipleChoiceFromOcrChunks(relevantChunks)
  ) {
    requestContext.imageQuestionType = 'image_multiple_choice_question';
  }

  if (requestContext.imageQuestionType) {
    logImageOcrDebug('selected-context', {
      imageQuestionType: requestContext.imageQuestionType,
      targetedDocumentId: selectedScopeDocumentIds.length === 1 ? Number(selectedScopeDocumentIds[0]) : null,
      selectedChunkIds: relevantChunks.map((chunk) => chunk.id),
      sourceDocumentIds: [...new Set(sources.map((source) => Number(source.documentId)))],
      hasOcrTextContext: relevantChunks.some((chunk) => String(chunk.promptContent || chunk.content || '').trim().length > 0),
    });
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

async function executeAsk({ primaryDocumentId, sessionId, userId, question, displayQuestion, mode, model, focusedDocumentId }) {
  const prepared = await prepareAsk({ primaryDocumentId, sessionId, userId, question, displayQuestion, mode, model, focusedDocumentId });
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
    overviewContext,
    overviewIntent,
  } = prepared;
  let generationResult;

  try {
    generationResult = await aiProviderService.generateAnswer({
      provider: selectedProvider,
      question: requestContext.substantiveQuestion || cleanedQuestion,
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
      overviewContext,
      overviewIntent,
      imageQuestionType: requestContext.imageQuestionType,
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

async function executeAskStream({ primaryDocumentId, sessionId, userId, question, displayQuestion, mode, model, focusedDocumentId, sendEvent }) {
  const prepared = await prepareAsk({ primaryDocumentId, sessionId, userId, question, displayQuestion, mode, model, focusedDocumentId, sendEvent });
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
    overviewContext,
    overviewIntent,
  } = prepared;

  let answer = '';
  let usageMetadata = null;
  sendEvent('status', { message: 'Generating answer...' });

  try {
    for await (const event of aiProviderService.streamAnswer({
      provider: selectedProvider,
      question: requestContext.substantiveQuestion || cleanedQuestion,
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
      overviewContext,
      overviewIntent,
      imageQuestionType: requestContext.imageQuestionType,
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
  return executeAsk({ ...args, primaryDocumentId: args.id });
}

async function askSession(args) {
  return executeAsk({ ...args, primaryDocumentId: null });
}

async function askDocumentStream(args) {
  return executeAskStream({ ...args, primaryDocumentId: args.id });
}

async function askSessionStream(args) {
  return executeAskStream({ ...args, primaryDocumentId: null });
}

async function retryDocumentOverview({ id, userId }) {
  const docId = normalizeNumericId(id, 'documentId');
  let doc = await documentService.canUseDocumentInChat(userId, docId);
  if (!doc) {
    const activeDoc = await documentModel.findActiveById(docId);
    if (activeDoc?.document_scope === 'session' && String(activeDoc.user_id) === String(userId)) {
      doc = activeDoc;
    }
  }
  if (!doc) {
    throw createError(404, 'Document not found');
  }
  return {
    overview: await documentOverviewService.retryOverview({ document: doc }),
  };
}

async function resolveRoadmapDocument({ id, userId }) {
  const docId = normalizeNumericId(id, 'documentId');
  let doc = await documentService.canUseDocumentInChat(userId, docId);
  if (!doc) {
    const activeDoc = await documentModel.findActiveById(docId);
    if (activeDoc?.document_scope === 'session' && String(activeDoc.user_id) === String(userId)) {
      doc = activeDoc;
    }
  }
  if (!doc) {
    throw createError(404, 'Document not found');
  }
  return doc;
}

async function getDocumentRoadmap({ id, userId }) {
  const doc = await resolveRoadmapDocument({ id, userId });
  const roadmap = await documentRoadmapModel.findByDocumentId(doc.id);
  const completedSteps = roadmap
    ? await documentRoadmapProgressModel.findByRoadmapAndUser(roadmap.id, userId)
    : [];
  return { roadmap, completedSteps };
}

async function retryDocumentRoadmap({ id, userId }) {
  const doc = await resolveRoadmapDocument({ id, userId });
  return {
    roadmap: await documentRoadmapService.retryRoadmap({ document: doc }),
  };
}

async function toggleRoadmapStep({ id, userId, stepOrder, completed }) {
  const doc = await resolveRoadmapDocument({ id, userId });
  const normalizedStepOrder = normalizeNumericId(stepOrder, 'stepOrder');
  const roadmap = await documentRoadmapModel.findByDocumentId(doc.id);
  if (!roadmap) {
    throw createError(404, 'Roadmap not found');
  }
  const stepExists = (roadmap.steps || []).some(
    (step) => Number(step.order) === normalizedStepOrder
  );
  if (!stepExists) {
    throw createError(400, 'stepOrder is invalid');
  }
  if (completed) {
    await documentRoadmapProgressModel.markStepComplete({
      roadmapId: roadmap.id,
      userId,
      stepOrder: normalizedStepOrder,
    });
  } else {
    await documentRoadmapProgressModel.markStepIncomplete({
      roadmapId: roadmap.id,
      userId,
      stepOrder: normalizedStepOrder,
    });
  }
  return {
    completedSteps: await documentRoadmapProgressModel.findByRoadmapAndUser(roadmap.id, userId),
  };
}

module.exports = {
  processDocument,
  retryDocumentOverview,
  getDocumentRoadmap,
  retryDocumentRoadmap,
  toggleRoadmapStep,
  askDocument,
  askDocumentStream,
  askSession,
  askSessionStream,
};
