const CHUNK_SIZE = 1600;
const CHUNK_OVERLAP = 220;
const MAX_CONTEXT_CHARS = 7000;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how',
  'i', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'was', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you',
]);

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
      chunks.push({
        content,
        tokenEstimate: estimateTokens(content),
        metadata: {
          ...metadata,
          startChar: start,
          endChar: end,
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

function retrieveRelevantChunks(question, chunks, limit = 4) {
  const questionTerms = tokenize(question);
  const ranked = (chunks || [])
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(questionTerms, chunk),
    }))
    .sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index);

  const matched = ranked.filter((chunk) => chunk.score > 0).slice(0, limit);
  const selected = matched.length ? matched : ranked.slice(0, Math.min(2, limit));

  let usedChars = 0;
  return selected.filter((chunk) => {
    const nextChars = usedChars + String(chunk.content || '').length;
    if (nextChars > MAX_CONTEXT_CHARS && usedChars > 0) return false;
    usedChars = nextChars;
    return true;
  });
}

function buildSourcePayload(chunks) {
  return (chunks || []).map((chunk) => ({
    id: chunk.id,
    chunkIndex: chunk.chunk_index,
    content: chunk.content,
    score: Number(chunk.score || 0),
    metadata: chunk.metadata || {},
  }));
}

module.exports = {
  splitTextIntoChunks,
  retrieveRelevantChunks,
  buildSourcePayload,
};
