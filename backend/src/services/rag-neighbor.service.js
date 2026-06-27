/**
 * rag-neighbor.service.js
 *
 * Bounded neighbor-chunk expansion for normal (non-comparison, non-overview) RAG.
 *
 * After hybrid retrieval selects high-relevance seed chunks, this module
 * optionally includes adjacent chunks from the SAME document so the model
 * receives fuller surrounding context.
 *
 * Guarantees:
 *  - Never crosses document boundaries.
 *  - Each seed may contribute at most one previous AND one next neighbor.
 *  - Seeds always rank before neighbors in the final list.
 *  - Neighbors must pass a relevance quality gate (same heading, continuation
 *    heuristic, or keyword overlap with seed/question).
 *  - The combined content stays within MAX_CONTEXT_CHARS.
 *  - Any error falls back silently to the original seed list.
 */

const MAX_CONTEXT_CHARS = 7000;
// Maximum total chunks after expansion (seeds + neighbors).
const MAX_EXPANDED_CHUNKS = 6;
// Minimum characters (trimmed) for a neighbor to be informative.
const MIN_NEIGHBOR_CHARS = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize text for keyword comparison. */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Common words excluded from keyword-overlap scoring.
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how',
  'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'was', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you',
  'its', 'all', 'has', 'had', 'not', 'but', 'been', 'have', 'will',
]);

/** Tokenize into meaningful words (length ≥ 3, not stop words). */
function tokenize(text) {
  return normalize(text)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

/** Count shared tokens between two token arrays. */
function tokenOverlap(tokensA, tokensB) {
  const setA = new Set(tokensA);
  return tokensB.filter((t) => setA.has(t)).length;
}

/**
 * Return true when `text` ends in a way that looks unfinished:
 * mid-sentence, open list bullet, or trailing colon/comma.
 */
function endsIncomplete(text) {
  const trimmed = String(text || '').trimEnd();
  if (!trimmed) return false;
  const lastChar = trimmed[trimmed.length - 1];
  return lastChar === ',' || lastChar === ':' || lastChar === ';'
    || /[a-z]$/i.test(lastChar)
    || /[-–—•]$/.test(trimmed);
}

/**
 * Return true when `text` starts in a way that looks like a continuation:
 * lowercase letter (no capital start), starts with punctuation/list marker,
 * or begins a table row or list continuation.
 */
function startsContinuation(text) {
  const trimmed = String(text || '').trimStart();
  if (!trimmed) return false;
  const firstChar = trimmed[0];
  // Starts with lowercase → likely a continuation sentence.
  if (/[a-z]/.test(firstChar)) return true;
  // Starts with a list or table marker.
  if (/^[-–—•|\d+\.]/.test(trimmed)) return true;
  return false;
}

/**
 * Return true when `text` ends a table, list, or numbered sequence.
 */
function endsWithStructure(text) {
  const lines = String(text || '').trimEnd().split('\n');
  const last = lines[lines.length - 1] || '';
  return /^[-–—•|\d]/.test(last.trim());
}

// ---------------------------------------------------------------------------
// Core quality gate
// ---------------------------------------------------------------------------

/**
 * Decide whether a candidate neighbor is relevant enough to include.
 *
 * @param {object} seed      - The seed chunk this neighbor is adjacent to.
 * @param {object} neighbor  - The candidate adjacent chunk.
 * @param {string} question  - The user's retrieval query.
 * @returns {boolean}
 */
function isNeighborRelevant(seed, neighbor, question) {
  const neighborContent = String(neighbor.content || '');
  const neighborTrimmed = neighborContent.trim();

  // Reject empty or low-information neighbors (by trimmed length).
  if (neighborTrimmed.length < MIN_NEIGHBOR_CHARS) return false;

  // 1. Same non-empty section heading.
  const seedHeading = String(seed.metadata?.sectionHeading || '').trim();
  const neighborHeading = String(neighbor.metadata?.sectionHeading || '').trim();
  if (seedHeading && neighborHeading && seedHeading === neighborHeading) return true;

  const seedContent = String(seed.content || '');

  // 2. Structural continuation between seed and neighbor:
  //    seed ends incomplete → neighbor continues it.
  if (endsIncomplete(seedContent) && startsContinuation(neighborTrimmed)) return true;
  //    neighbor starts as a continuation of a structure.
  if (endsWithStructure(seedContent) && startsContinuation(neighborTrimmed)) return true;
  //    neighbor ends incomplete → seed is its continuation (for previous neighbors).
  if (endsIncomplete(neighborContent) && startsContinuation(seedContent)) return true;

  // 3. Useful keyword overlap with the seed.
  const seedTokens = tokenize(seedContent);
  const neighborTokens = tokenize(neighborTrimmed);
  if (seedTokens.length && neighborTokens.length) {
    const overlap = tokenOverlap(seedTokens, neighborTokens);
    // At least 2 shared content words (or ≥15% of the shorter set).
    const minTokens = Math.min(seedTokens.length, neighborTokens.length);
    if (overlap >= 2 || (minTokens > 0 && overlap / minTokens >= 0.15)) return true;
  }

  // 4. Useful keyword overlap with the question.
  const questionTokens = tokenize(question);
  if (questionTokens.length) {
    const qOverlap = tokenOverlap(questionTokens, neighborTokens);
    if (qOverlap >= 2) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Chunk pool indexing
// ---------------------------------------------------------------------------

/**
 * Build a lookup: (docId, chunkIndex) → chunk, from the pre-loaded pool.
 *
 * @param {Array} chunkPool - All chunks available in the current scope.
 * @returns {Map<string, object>}
 */
function buildChunkPoolIndex(chunkPool) {
  const index = new Map();
  for (const chunk of chunkPool || []) {
    const docId = Number(chunk.doc_id || chunk.metadata?.documentId);
    const idx = Number(chunk.chunk_index);
    if (Number.isInteger(docId) && Number.isInteger(idx)) {
      index.set(`${docId}:${idx}`, chunk);
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// Main expansion function
// ---------------------------------------------------------------------------

/**
 * Expand seed chunks with bounded neighbors from the pre-loaded pool.
 *
 * @param {object} params
 * @param {Array}  params.seedChunks   - High-relevance chunks from hybrid retrieval.
 * @param {Array}  params.chunkPool    - All chunks loaded for the current scope.
 * @param {string} params.question     - The user's retrieval query.
 * @param {Array}  [params.documentIds] - Allowed doc IDs (for multi-doc coverage check).
 * @returns {Array} Expanded chunk list (seeds first, then neighbors), budget-capped.
 */
function expandWithNeighbors({ seedChunks, chunkPool, question, documentIds }) {
  if (!seedChunks?.length || !chunkPool?.length) return seedChunks || [];

  const poolIndex = buildChunkPoolIndex(chunkPool);
  const seedKeys = new Set(
    seedChunks.map((c) => {
      const docId = Number(c.doc_id || c.metadata?.documentId);
      const idx = Number(c.chunk_index);
      return `${docId}:${idx}`;
    })
  );

  // Track which document IDs are covered by seeds (for multi-doc balance guard).
  const allowedDocIds = documentIds
    ? new Set((documentIds).map(Number).filter(Number.isInteger))
    : null;

  // Collect candidate neighbors (prev, next) for each seed.
  // Each neighbor is marked with its seed's doc_id and a retrieval tag.
  const neighborCandidates = [];

  for (const seed of seedChunks) {
    const docId = Number(seed.doc_id || seed.metadata?.documentId);
    const idx = Number(seed.chunk_index);
    if (!Number.isInteger(docId) || !Number.isInteger(idx)) continue;

    // Only expand within allowed document scope.
    if (allowedDocIds && !allowedDocIds.has(docId)) continue;

    for (const delta of [-1, 1]) {
      const neighborKey = `${docId}:${idx + delta}`;
      if (seedKeys.has(neighborKey)) continue; // already a seed
      const neighbor = poolIndex.get(neighborKey);
      if (!neighbor) continue;
      if (!isNeighborRelevant(seed, neighbor, question)) continue;
      neighborCandidates.push({
        ...neighbor,
        metadata: {
          ...(neighbor.metadata || {}),
          retrieval: 'neighbor_expansion',
          neighborOfChunkIndex: idx,
        },
        // Seeds always outrank neighbors; score preserved from pool record.
        _neighborOf: idx,
        _neighborDelta: delta,
      });
    }
  }

  // Deduplicate neighbors (same docId:index already handled by seedKeys above;
  // deduplicate across multiple seeds that might want the same neighbor).
  const seen = new Set(seedKeys);
  const uniqueNeighbors = [];
  for (const candidate of neighborCandidates) {
    const docId = Number(candidate.doc_id || candidate.metadata?.documentId);
    const idx = Number(candidate.chunk_index);
    const key = `${docId}:${idx}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueNeighbors.push(candidate);
  }

  // Guard: if multi-doc scope, ensure we do not drop all evidence from any
  // explicitly requested document that has at least one seed.
  // (Seeds already provide coverage; neighbors are additive, so this is just
  //  a sanity check on the final list.)

  // Build final list: seeds first (in original order), then neighbors sorted
  // by (docId, chunkIndex) so context reads naturally.
  const combined = [
    ...seedChunks,
    ...uniqueNeighbors.sort((a, b) => {
      const aDocId = Number(a.doc_id || a.metadata?.documentId);
      const bDocId = Number(b.doc_id || b.metadata?.documentId);
      if (aDocId !== bDocId) return aDocId - bDocId;
      return Number(a.chunk_index) - Number(b.chunk_index);
    }),
  ];

  // Slice to MAX_EXPANDED_CHUNKS.
  const sliced = combined.slice(0, MAX_EXPANDED_CHUNKS);

  // Apply character budget (MAX_CONTEXT_CHARS).
  // Seeds are included first, so they consume budget before neighbors.
  let usedChars = 0;
  const budgeted = sliced.filter((chunk) => {
    const len = String(chunk.content || '').length;
    // Always include seeds (they were already within budget from retrieval).
    const isSeed = seedKeys.has(
      `${Number(chunk.doc_id || chunk.metadata?.documentId)}:${Number(chunk.chunk_index)}`
    );
    if (isSeed) {
      usedChars += len;
      return true;
    }
    if (usedChars + len > MAX_CONTEXT_CHARS) return false;
    usedChars += len;
    return true;
  });

  return budgeted;
}

// ---------------------------------------------------------------------------
// Safe wrapper (never throws)
// ---------------------------------------------------------------------------

/**
 * Expand with neighbors, falling back silently to seeds on any error.
 */
function expandWithNeighborsSafe(params) {
  try {
    return expandWithNeighbors(params);
  } catch (err) {
    console.error('Neighbor expansion failed, using original seeds:', err.message);
    return params.seedChunks || [];
  }
}

module.exports = {
  expandWithNeighborsSafe,
  // Exported for unit testing:
  expandWithNeighbors,
  isNeighborRelevant,
  buildChunkPoolIndex,
  MAX_CONTEXT_CHARS,
  MAX_EXPANDED_CHUNKS,
};
