/**
 * rag-rerank.service.js
 *
 * Lightweight rule-based evidence reranking and pruning applied after hybrid
 * retrieval + neighbor expansion, before the evidence is sent to the LLM.
 *
 * Applied ONLY to normal (non-comparison, non-overview) RAG.
 *
 * Pipeline:
 *   seeds + neighbor chunks
 *     → re-score each chunk (vector, keyword, heading, role/topic, neighbor tag)
 *     → apply intent-sensitive penalties
 *     → sort by final score descending
 *     → prune to FINAL_CHUNK_TARGET (normally 3-5, max 6)
 *     → enforce MAX_CONTEXT_CHARS budget
 *     → restore minimum coverage for explicit multi-doc requests
 *     → return (falls back silently on any error)
 */

const MAX_CONTEXT_CHARS = 7000;
const FINAL_CHUNK_MAX = 6;
const FINAL_CHUNK_TARGET = 4; // soft target; may keep up to FINAL_CHUNK_MAX

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how',
  'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'was', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you',
  'its', 'all', 'has', 'had', 'not', 'but', 'been', 'have', 'will', 'can',
  'may', 'also', 'more', 'into', 'use', 'used', 'using', 'each', 'such',
]);

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function tokenSet(text) {
  return new Set(tokenize(text));
}

/** Count how many tokens from `setA` appear in `arrB`. */
function overlapCount(setA, arrB) {
  return arrB.filter((t) => setA.has(t)).length;
}

// ---------------------------------------------------------------------------
// Intent extraction
// ---------------------------------------------------------------------------

/**
 * Roles: generic sets of synonyms.  We detect whether the question focuses on
 * one role so we can penalize chunks that are exclusively about another.
 */
const ROLE_GROUPS = [
  { name: 'student',   terms: new Set(['student', 'sinh', 'vien', 'hoc', 'sinh vien', 'learner', 'learners']) },
  { name: 'admin',     terms: new Set(['admin', 'administrator', 'administrators', 'manage', 'management', 'quan', 'tri', 'manager']) },
  { name: 'teacher',   terms: new Set(['teacher', 'lecturer', 'instructor', 'giao', 'vien', 'giang', 'vien', 'professor']) },
];

/**
 * Topic signals: when a question matches a topic cluster, chunks about
 * semantically unrelated clusters are lightly penalized.
 */
const TOPIC_CLUSTERS = [
  { name: 'upload',    terms: new Set(['upload', 'uploads', 'uploading', 'file', 'files', 'attach', 'attachment', 'store', 'storage', 'extract', 'extraction', 'processing', 'validate', 'validation']) },
  { name: 'swot',      terms: new Set(['swot', 'strength', 'strengths', 'weakness', 'weaknesses', 'opportunity', 'opportunities', 'threat', 'threats', 'diem', 'manh', 'yeu', 'co', 'hoi', 'thach', 'thuc']) },
  { name: 'auth',      terms: new Set(['login', 'logout', 'register', 'registration', 'authenticate', 'authentication', 'password', 'token', 'jwt', 'session', 'oauth']) },
  { name: 'search',    terms: new Set(['search', 'find', 'query', 'filter', 'browse', 'tag', 'tags', 'bookmark', 'bookmarks']) },
  { name: 'report',    terms: new Set(['report', 'reports', 'statistic', 'statistics', 'dashboard', 'chart', 'analytics', 'overview', 'summary', 'bao', 'cao', 'thong', 'ke']) },
  { name: 'payment',   terms: new Set(['payment', 'pay', 'invoice', 'billing', 'subscription', 'plan', 'fee', 'price']) },
  { name: 'database',  terms: new Set(['database', 'schema', 'table', 'sql', 'mysql', 'postgres', 'supabase', 'firebase', 'erd', 'relation', 'entity', 'index']) },
  { name: 'api',       terms: new Set(['api', 'endpoint', 'rest', 'route', 'request', 'response', 'http', 'get', 'post', 'put', 'delete', 'patch']) },
  { name: 'ai_chat',   terms: new Set(['chat', 'rag', 'embedding', 'vector', 'llm', 'model', 'gemini', 'ollama', 'answer', 'context', 'chunk', 'retrieval']) },
  { name: 'ui',        terms: new Set(['ui', 'interface', 'screen', 'page', 'component', 'button', 'react', 'frontend', 'form', 'render']) },
];

/**
 * Extract the dominant role from a question (or null).
 * @param {string[]} questionTokens
 * @returns {string|null} role name
 */
function detectQuestionRole(questionTokens) {
  const qSet = new Set(questionTokens);
  for (const group of ROLE_GROUPS) {
    let hits = 0;
    for (const term of group.terms) { if (qSet.has(term)) hits++; }
    if (hits >= 1) return group.name;
  }
  return null;
}

/**
 * Detect which topic clusters the question belongs to (may be multiple).
 * @param {string[]} questionTokens
 * @returns {Set<string>} set of matched cluster names
 */
function detectQuestionTopics(questionTokens) {
  const qSet = new Set(questionTokens);
  const matched = new Set();
  for (const cluster of TOPIC_CLUSTERS) {
    let hits = 0;
    for (const term of cluster.terms) { if (qSet.has(term)) hits++; }
    if (hits >= 1) matched.add(cluster.name);
  }
  return matched;
}

/**
 * Detect which topic clusters a chunk content primarily belongs to.
 * @param {string[]} chunkTokens
 * @returns {Set<string>}
 */
function detectChunkTopics(chunkTokens) {
  const cSet = new Set(chunkTokens);
  const matched = new Set();
  for (const cluster of TOPIC_CLUSTERS) {
    let hits = 0;
    for (const term of cluster.terms) { if (cSet.has(term)) hits++; }
    // Require at least 2 hits for a chunk to be "about" a topic.
    if (hits >= 2) matched.add(cluster.name);
  }
  return matched;
}

/**
 * Detect which role a chunk primarily describes.
 * @param {string[]} chunkTokens
 * @returns {string|null}
 */
function detectChunkRole(chunkTokens) {
  const cSet = new Set(chunkTokens);
  let bestRole = null;
  let bestHits = 0;
  for (const group of ROLE_GROUPS) {
    let hits = 0;
    for (const term of group.terms) { if (cSet.has(term)) hits++; }
    if (hits > bestHits) { bestHits = hits; bestRole = group.name; }
  }
  // Require at least 2 hits to classify a chunk as role-specific.
  return bestHits >= 2 ? bestRole : null;
}

// ---------------------------------------------------------------------------
// Low-information detector
// ---------------------------------------------------------------------------

const LOW_INFO_PATTERNS = [
  /^[\s\d\-–—•|]+$/, // only whitespace, numbers, bullets, dashes
  /^\s*(?:table of contents|mục lục|contents?)\s*$/i,
  /^(?:\s*page\s+\d+\s*)+$/i,
];

function isLowInformation(content) {
  const text = String(content || '').trim();
  if (text.length < 40) return true;
  if (LOW_INFO_PATTERNS.some((p) => p.test(text))) return true;
  // If more than 60% of characters are non-letter (e.g. symbol-heavy table header)
  const letterCount = (text.match(/\p{L}/gu) || []).length;
  return text.length > 0 && letterCount / text.length < 0.35;
}

// ---------------------------------------------------------------------------
// Per-chunk scorer
// ---------------------------------------------------------------------------

/**
 * Compute a composite relevance score for a chunk given the question.
 *
 * Positive factors:
 *   +1.5  × vector similarity (0–1, when available)
 *   +0–3  keyword overlap with question (normalized)
 *   +0.4  section heading matches a question term
 *   +0.3  same role as question
 *   +0.2  chunk topic overlaps with question topic
 *   −0.2  neighbor discount (chunk was not independently retrieved)
 *
 * Negative factors (penalties):
 *   −0.5  role mismatch (chunk is clearly about a different role)
 *   −0.3  topic mismatch (question has a clear topic; chunk is exclusively off-topic)
 *   −0.8  low-information chunk
 *   −0.3  near-duplicate of a higher-scored chunk (≥ 70% token overlap)
 *
 * @param {object} chunk
 * @param {string[]} questionTokens  - Already tokenized question.
 * @param {string|null} questionRole
 * @param {Set<string>} questionTopics
 * @param {Set<string>} seenTokenSignatures  - Running set of token fingerprints for dup detection.
 * @returns {number} composite score
 */
function scoreChunk(chunk, questionTokens, questionRole, questionTopics, seenTokenSignatures) {
  let score = 0;

  // ── 1. Vector similarity ────────────────────────────────────────────────
  const vectorSim = Number(chunk.similarity ?? chunk.vectorScore ?? chunk.vector_score ?? 0);
  if (vectorSim > 0) score += vectorSim * 1.5;

  // ── 2. Keyword overlap with question ───────────────────────────────────
  const chunkTokenArr = tokenize(String(chunk.content || ''));
  const chunkTokens = tokenSet(String(chunk.content || ''));
  const questionSet = new Set(questionTokens);
  const kwOverlap = overlapCount(questionSet, chunkTokenArr);
  if (questionTokens.length > 0) {
    // Normalize by question length; cap contribution at 3.
    const normalizedKw = Math.min(3, kwOverlap / Math.max(1, questionTokens.length) * 6);
    score += normalizedKw;
  }

  // ── 3. Section heading bonus ────────────────────────────────────────────
  const heading = normalizeText(chunk.metadata?.sectionHeading || '');
  if (heading) {
    const headingTokens = tokenize(heading);
    if (overlapCount(questionSet, headingTokens) >= 1) score += 0.4;
  }

  // ── 4. Role match / mismatch ────────────────────────────────────────────
  const chunkRole = detectChunkRole(chunkTokenArr);
  if (questionRole) {
    if (chunkRole === questionRole) score += 0.3;
    else if (chunkRole !== null && chunkRole !== questionRole) score -= 0.5;
  }

  // ── 5. Topic match / mismatch ───────────────────────────────────────────
  if (questionTopics.size > 0) {
    const chunkTopics = detectChunkTopics(chunkTokenArr);
    const topicMatch = [...questionTopics].some((t) => chunkTopics.has(t));
    if (topicMatch) {
      score += 0.2;
    } else if (chunkTopics.size > 0) {
      // Chunk is clearly about something else entirely.
      score -= 0.3;
    }
  }

  // ── 6. Neighbor discount ────────────────────────────────────────────────
  if (chunk.metadata?.retrieval === 'neighbor_expansion') score -= 0.2;

  // ── 7. Low-information penalty ──────────────────────────────────────────
  if (isLowInformation(chunk.content)) score -= 0.8;

  // ── 8. Near-duplicate penalty ───────────────────────────────────────────
  // Fingerprint = sorted unique tokens, joined.  If ≥ 70% of this chunk's
  // tokens appear in an already-seen fingerprint, it is near-duplicate.
  if (chunkTokenArr.length > 0) {
    const fingerprint = [...chunkTokens].sort().join('|');
    let isDuplicate = false;
    for (const prevFp of seenTokenSignatures) {
      const prevTokens = new Set(prevFp.split('|'));
      const shared = chunkTokenArr.filter((t) => prevTokens.has(t)).length;
      if (shared / chunkTokenArr.length >= 0.7) { isDuplicate = true; break; }
    }
    if (isDuplicate) score -= 0.3;
    seenTokenSignatures.add(fingerprint);
  }

  return score;
}

// ---------------------------------------------------------------------------
// Main reranker
// ---------------------------------------------------------------------------

/**
 * Rerank and prune the expanded evidence list.
 *
 * @param {object} params
 * @param {Array}  params.chunks          - Seeds + neighbor-expanded chunks.
 * @param {string} params.question        - User's retrieval query.
 * @param {string} [params.scopeType]     - 'general' | 'explicit_single' | 'explicit_multi'
 * @param {number[]} [params.documentIds] - For multi-doc, IDs that must retain coverage.
 * @returns {Array} Reranked, pruned, budget-capped chunk list.
 */
function rerankAndPrune({ chunks, question, scopeType, documentIds }) {
  if (!chunks?.length) return chunks || [];

  const questionTokens = tokenize(question);
  const questionRole = detectQuestionRole(questionTokens);
  const questionTopics = detectQuestionTopics(questionTokens);

  // Seed chunk keys (those NOT marked neighbor_expansion) — for reference only.
  const seedChunkKeys = new Set(
    chunks
      .filter((c) => c.metadata?.retrieval !== 'neighbor_expansion')
      .map((c) => `${Number(c.doc_id)}:${Number(c.chunk_index)}`)
  );

  // Score every chunk. Pass a running duplicate-signature set so near-duplicates
  // across the list are detected in one pass.
  const seenSignatures = new Set();
  const scored = chunks.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, questionTokens, questionRole, questionTopics, seenSignatures),
  }));

  // Sort descending by score.
  scored.sort((a, b) => b.score - a.score);

  // ── Multi-doc coverage anchor ──────────────────────────────────────────
  // If explicit_multi, record the highest-scored chunk per requested document
  // so we can restore it if pruning would drop all evidence for that doc.
  const requiredDocIds = (scopeType === 'explicit_multi' && documentIds?.length)
    ? new Set(documentIds.map(Number))
    : new Set();

  const bestPerDoc = new Map();
  if (requiredDocIds.size > 0) {
    for (const { chunk, score } of scored) {
      const docId = Number(chunk.doc_id || chunk.metadata?.documentId);
      if (requiredDocIds.has(docId) && !bestPerDoc.has(docId)) {
        bestPerDoc.set(docId, { chunk, score });
      }
    }
  }

  // ── Select chunks ──────────────────────────────────────────────────────
  // Take up to FINAL_CHUNK_MAX chunks by score, within budget.
  let usedChars = 0;
  let selectedCount = 0;
  const selected = [];
  const selectedDocIds = new Set();

  for (const { chunk } of scored) {
    if (selectedCount >= FINAL_CHUNK_MAX) break;
    const len = String(chunk.content || '').length;
    if (usedChars + len > MAX_CONTEXT_CHARS && usedChars > 0) continue;
    selected.push(chunk);
    selectedDocIds.add(Number(chunk.doc_id || chunk.metadata?.documentId));
    usedChars += len;
    selectedCount++;
    // Stop early if we have FINAL_CHUNK_TARGET and the next chunk would
    // clearly be low-information or near-zero score.
    if (selectedCount >= FINAL_CHUNK_TARGET) {
      const nextScored = scored[selectedCount];
      if (!nextScored || nextScored.score <= 0) break;
    }
  }

  // ── Restore coverage for multi-doc requests ────────────────────────────
  // If any required document lost all its evidence, re-add its best chunk.
  for (const [docId, { chunk }] of bestPerDoc) {
    if (!selectedDocIds.has(docId)) {
      const len = String(chunk.content || '').length;
      if (selected.length < FINAL_CHUNK_MAX && usedChars + len <= MAX_CONTEXT_CHARS) {
        selected.push(chunk);
        selectedDocIds.add(docId);
        usedChars += len;
      }
    }
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Safe wrapper
// ---------------------------------------------------------------------------

/**
 * Rerank and prune, falling back silently to the original chunk list on error.
 */
function rerankAndPruneSafe(params) {
  try {
    const result = rerankAndPrune(params);
    // Sanity: never return fewer chunks than needed for multi-doc coverage.
    if (result.length === 0 && params.chunks?.length > 0) return params.chunks;
    return result;
  } catch (err) {
    console.error('Evidence reranking failed, using original list:', err.message);
    return params.chunks || [];
  }
}

module.exports = {
  rerankAndPruneSafe,
  // Exported for unit tests:
  rerankAndPrune,
  scoreChunk,
  detectQuestionRole,
  detectQuestionTopics,
  detectChunkTopics,
  detectChunkRole,
  isLowInformation,
  MAX_CONTEXT_CHARS,
  FINAL_CHUNK_MAX,
  FINAL_CHUNK_TARGET,
};
