const CHUNK_SIZE = 1600;
const CHUNK_OVERLAP = 220;
const MAX_CONTEXT_CHARS = 7000;
const FALLBACK_CHUNK_LIMIT = 2;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how',
  'i', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'was', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you',
]);

const REQUIREMENT_ID_PATTERN = /\b(?:REQ|FR|NFR|UC|BR|SR)[-_ ]?\d+(?:\.\d+)*\b/giu;

function extractRequirementIds(text) {
  return [...new Set((String(text || '').match(REQUIREMENT_ID_PATTERN) || [])
    .map((value) => value.toUpperCase().replace(/[ _]/g, '-')))];
}

function looksLikeHeading(line) {
  const value = String(line || '').trim();
  if (!value || value.length > 120) return false;
  if (/^#{1,6}\s+/.test(value)) return true;
  if (/^\d+(?:\.\d+)*[.)]?\s+\S+/.test(value)) return true;
  if (/^(?:REQ|FR|NFR|UC|BR|SR)[-_ ]?\d+/iu.test(value)) return true;
  if (value.endsWith(':') && value.split(/\s+/).length <= 12) return true;
  return value.length >= 4
    && value.split(/\s+/).length <= 10
    && !/[.!?]$/.test(value);
}

function inferSectionHeading(text, startChar = 0) {
  const before = String(text || '').slice(0, Math.max(0, startChar));
  const current = String(text || '').slice(Math.max(0, startChar), Math.max(0, startChar) + 500);
  const candidates = [
    ...before.split('\n').slice(-4).reverse(),
    ...current.split('\n').slice(0, 3),
  ];
  return candidates.find(looksLikeHeading)?.replace(/^#{1,6}\s+/, '').trim() || null;
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function splitTextIntoChunks(text, metadata = {}) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);
    const nextBreak = normalized.lastIndexOf('\n', end);
    const nextSentence = normalized.lastIndexOf('. ', end);
    const breakPoint = Math.max(nextBreak, nextSentence);

    if (breakPoint > start + CHUNK_SIZE * 0.6) {
      end = breakPoint + (breakPoint === nextSentence ? 1 : 0);
    }

    const content = normalized.slice(start, end).trim();
    if (content) {
      const pageBoundaries = Array.isArray(metadata.pageBoundaries)
        ? metadata.pageBoundaries
        : [];
      const chunkPages = pageBoundaries.filter((page) => (
        Number(page.endChar) > start && Number(page.startChar) < end
      ));
      const chunkMetadata = { ...metadata };
      delete chunkMetadata.pageBoundaries;
      const sectionHeading = inferSectionHeading(normalized, start);

      chunks.push({
        content,
        tokenEstimate: estimateTokens(content),
        metadata: {
          ...chunkMetadata,
          startChar: start,
          endChar: end,
          pageNumber: chunkPages.length === 1 ? Number(chunkPages[0].pageNumber) : null,
          pageStart: chunkPages.length ? Number(chunkPages[0].pageNumber) : null,
          pageEnd: chunkPages.length
            ? Number(chunkPages[chunkPages.length - 1].pageNumber)
            : null,
          sectionHeading,
          requirementIds: extractRequirementIds(content),
        },
      });
    }

    if (end >= normalized.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function scoreChunk(questionTerms, chunk) {
  const content = String(chunk.content || '').toLowerCase();
  const uniqueTerms = [...new Set(questionTerms)];
  let score = 0;

  for (const term of uniqueTerms) {
    const occurrences = content.split(term).length - 1;
    score += occurrences > 0 ? 1 + Math.min(occurrences, 3) * 0.25 : 0;
  }

  return score;
}

function rankRelevantChunks(question, chunks, limit = 4) {
  const questionTerms = tokenize(question);
  return (chunks || [])
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(questionTerms, chunk),
    }))
    .sort((a, b) => b.score - a.score || Number(a.chunk_index || 0) - Number(b.chunk_index || 0))
    .slice(0, limit);
}

function retrieveRelevantChunks(question, chunks, limit = 4) {
  const availableChunks = chunks || [];
  const ranked = rankRelevantChunks(question, availableChunks, availableChunks.length);

  const matched = ranked.filter((chunk) => chunk.score > 0).slice(0, limit);
  const firstByDocument = new Map();
  for (const chunk of availableChunks
    .slice()
    .sort((a, b) => Number(a.chunk_index || 0) - Number(b.chunk_index || 0))) {
    const documentKey = Number(chunk.doc_id || chunk.metadata?.documentId) || 'unknown';
    if (!firstByDocument.has(documentKey)) firstByDocument.set(documentKey, chunk);
  }
  const firstChunks = [...firstByDocument.values()]
    .slice(0, Math.min(FALLBACK_CHUNK_LIMIT, limit));
  const selected = matched.length ? matched : firstChunks;

  let usedChars = 0;
  return selected.filter((chunk) => {
    const nextChars = usedChars + String(chunk.content || '').length;
    if (nextChars > MAX_CONTEXT_CHARS && usedChars > 0) return false;
    usedChars = nextChars;
    return true;
  });
}

function buildValidatedEvidence(chunks, documentsById = new Map()) {
  const seen = new Set();
  const evidence = [];
  const rejected = [];

  for (const chunk of chunks || []) {
    const actualDocumentId = Number(chunk.doc_id);
    const metadataDocumentId = Number(chunk.metadata?.documentId);
    const document = documentsById.get(actualDocumentId);
    const canonicalTitle = String(document?.title || '').trim();
    const declaredTitle = String(chunk.documentTitle || chunk.metadata?.documentTitle || '').trim();
    const chunkId = chunk.id ?? null;
    const ownershipKey = `${actualDocumentId}:${chunkId ?? `index-${chunk.chunk_index}`}`;
    const reason = !Number.isInteger(actualDocumentId)
      ? 'missing_actual_document_id'
      : !document
        ? 'document_not_in_authorized_scope'
        : Number.isInteger(metadataDocumentId) && metadataDocumentId !== actualDocumentId
          ? 'metadata_document_id_mismatch'
          : declaredTitle && canonicalTitle && declaredTitle !== canonicalTitle
            ? 'document_title_mismatch'
            : null;

    if (reason || seen.has(ownershipKey)) {
      if (reason) {
        rejected.push({
          reason,
          chunkId,
          chunkIndex: chunk.chunk_index,
          actualDocumentId: Number.isInteger(actualDocumentId) ? actualDocumentId : null,
          metadataDocumentId: Number.isInteger(metadataDocumentId) ? metadataDocumentId : null,
          declaredTitle: declaredTitle || null,
          canonicalTitle: canonicalTitle || null,
        });
        console.error('RAG source ownership invariant rejected a chunk:', rejected.at(-1));
      }
      continue;
    }

    seen.add(ownershipKey);
    const metadata = Object.freeze({
      ...(chunk.metadata || {}),
      documentId: actualDocumentId,
      documentTitle: canonicalTitle,
    });
    const canonicalChunk = Object.freeze({
      ...chunk,
      doc_id: actualDocumentId,
      documentId: actualDocumentId,
      documentTitle: canonicalTitle,
      metadata,
    });
    const source = Object.freeze({
      id: chunkId,
      chunkId,
      documentId: actualDocumentId,
      chunkDocumentId: actualDocumentId,
      documentTitle: canonicalTitle,
      chunkIndex: chunk.chunk_index,
      pageNumber: metadata.pageNumber ?? null,
      pageStart: metadata.pageStart ?? metadata.pageNumber ?? null,
      pageEnd: metadata.pageEnd ?? metadata.pageNumber ?? null,
      content: chunk.content,
      score: Number(chunk.score || 0),
      similarity: chunk.similarity == null ? null : Number(chunk.similarity),
      metadata,
    });
    evidence.push({ chunk: canonicalChunk, source });
  }

  return {
    chunks: evidence.map((item) => item.chunk),
    sources: evidence.map((item) => item.source),
    validation: {
      accepted: evidence.length,
      rejected,
      valid: rejected.length === 0,
    },
  };
}

function buildSourcePayload(chunks, documentsById = new Map()) {
  return buildValidatedEvidence(chunks, documentsById).sources;
}

module.exports = {
  MAX_CONTEXT_CHARS,
  extractRequirementIds,
  inferSectionHeading,
  rankRelevantChunks,
  splitTextIntoChunks,
  tokenize,
  retrieveRelevantChunks,
  buildValidatedEvidence,
  buildSourcePayload,
};
