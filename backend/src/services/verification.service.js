/**
 * verification.service.js
 *
 * Lightweight post-retrieval, pre-generation verification layer.
 *
 * Pipeline position:
 *   buildValidatedEvidence()
 *     → verifyEvidenceSafe()           ← ENTRY POINT
 *       → shouldVerify() gate          ← fast, no LLM, intent-based
 *       → activeVerifier.verify()      ← pluggable backend (currently Ollama)
 *     → aiProviderService.generateAnswer() / streamAnswer()
 *
 * Extension guide (future web-search backend):
 *   1. Create a new verifier module exporting { verify(question, chunks) → VerifierResult }.
 *   2. Replace the `activeVerifier` assignment below with the new module.
 *   3. No changes needed in ai.service.js or ai-provider.service.js.
 *
 * Design invariants:
 *  - NEVER replaces or modifies document content.
 *  - NEVER blocks the primary answer on any error.
 *  - Only classifies evidence; the main LLM decides final phrasing.
 *  - All external calls are time-bounded by VERIFY_TIMEOUT_MS.
 *
 * Verdict enum (the only valid values, no numeric confidence):
 *   'verified'      — evidence consistent with established knowledge
 *   'uncertain'     — cannot confirm or deny from general knowledge
 *   'contradicted'  — evidence contradicts established knowledge
 */

'use strict';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const VERIFY_TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS) || 3000;
const VERIFY_DEBUG = process.env.VERIFY_DEBUG === 'true' && process.env.NODE_ENV !== 'production';

/** Maximum characters of chunk content sent to the verifier (keeps latency low). */
const MAX_CHUNK_CHARS_FOR_VERIFY = 800;

/** Maximum characters of the user question sent to the verifier. */
const MAX_QUESTION_CHARS_FOR_VERIFY = 200;

/** How many top chunks to include in the verification prompt (speed/accuracy balance). */
const MAX_CHUNKS_FOR_VERIFY = 2;

// ---------------------------------------------------------------------------
// Verdict enum
// ---------------------------------------------------------------------------

/**
 * All valid verdicts. Defined once here so the parser, badge builder,
 * and tests all reference the same source of truth.
 */
const VERDICTS = Object.freeze({
  VERIFIED: 'verified',
  UNCERTAIN: 'uncertain',
  CONTRADICTED: 'contradicted',
});

const VALID_VERDICT_SET = new Set(Object.values(VERDICTS));

// ---------------------------------------------------------------------------
// Gate: shouldVerify()
//
// Philosophy: verification exists to detect when a document's factual claims
// conflict with established real-world knowledge. It should ONLY run when the
// user is asking for factual correctness or real-world accuracy.
//
// It must NOT run when the user is simply reading, summarising, or navigating
// the document — those requests should be answered directly from the document.
// ---------------------------------------------------------------------------

/**
 * Patterns that signal the user is asking about real-world factual accuracy.
 * These are the ONLY cases where verification adds value.
 *
 * Matches Vietnamese and English phrasing.
 */
const FACTUAL_CORRECTNESS_QUESTION_PATTERN = /\b((?:có\s+)?(?:đúng|chính\s*xác|sai|thật|thực\s*tế|ngoài\s*thực\s*tế)(?:\s+không)?|is\s+this\s+(?:correct|accurate|right|true|false)|(?:is|are)\s+(?:it|they|this|these)\s+(?:correct|accurate|right)|(?:fact[\s-]?check|verify|verif(?:y|ied))|(?:in\s+)?(?:reality|real\s+life|in\s+fact|actually)|(?:thông\s*tin\s+)?(?:này|đây)\s+có\s+(?:đúng|chính\s*xác)|có\s+phải\s+|(?:điều\s+này|thông\s+tin\s+này)\s+có\s+|giải\s+thích\s+(?:hiện\s+tượng|nguyên\s+nhân|tại\s+sao|vì\s+sao))\b/iu;

/**
 * Patterns that signal the user is simply reading, exploring, or summarising
 * the document. These requests should SKIP verification entirely.
 */
const DOCUMENT_READING_PATTERN = /\b((?:tài\s*liệu|file|văn\s*bản|đoạn|phần|nội\s*dung)\s+(?:này|đây|nói|ghi|đề\s*cập|viết|trình\s*bày)|theo\s+(?:file|tài\s*liệu|văn\s*bản|đoạn|phần)|(?:tóm\s*tắt|tổng\s*hợp|liệt\s*kê|đọc|trình\s*bày|mô\s*tả|giải\s*thích\s+trong\s+tài\s*liệu)|(?:summari[sz]e|summarise|describe|list|enumerate|what\s+does\s+(?:the\s+)?(?:document|file)\s+say)|(?:according\s+to\s+(?:the\s+)?(?:document|file|text))|(?:in\s+the\s+(?:document|file|text))|(?:từ\s+(?:file|tài\s*liệu))|đọc\s+(?:nguyên\s*văn|lại|cho\s+tôi)|(?:workflow|quy\s*trình|cách\s+hoạt\s+động)\s+(?:là|như\s+thế\s+nào|trong\s+file)|(?:creative|write\s+a|draft|paraphrase|rewrite|poem|essay|story))\b/iu;

/**
 * Patterns on question text that unconditionally skip verification.
 * These cover opinion, preference, and reformatting requests.
 */
const SKIP_QUESTION_PATTERN = /\b((?:your\s+)?(?:opinion|view|perspective|recommendation)|(?:what\s+do\s+you\s+think)|(?:prefer|suggest|advise|recommend)|(?:translate|rephrase|ngắn\s+gọn|dịch\s+sang)|(?:format\s+as|convert\s+to))\b/iu;

/**
 * Patterns on chunk content that signal user-owned specification documents.
 * These should never be fact-checked against external knowledge.
 */
const SKIP_SPEC_DOC_PATTERN = /\b(REQ|FR|NFR|UC|BR|SR)[-_ ]?\d+/iu;

/**
 * Returns true when the request warrants factual verification.
 *
 * Decision logic:
 *   1. Hard-disabled → skip
 *   2. System intents (comparison, overview, image) → skip
 *   3. document_only mode → skip (user trusts the doc)
 *   4. Question is clearly about reading/summarising the doc → skip
 *   5. Question is about opinion/format → skip
 *   6. Chunk content looks like a spec document → skip
 *   7. Question explicitly asks about factual correctness → verify
 *   8. All other cases → skip (conservative default)
 *
 * @param {string}   question       - Cleaned user question.
 * @param {object}   requestContext - Context from chat-context.service.analyzeRequest().
 * @param {string}   answerMode     - 'hybrid' | 'document_only'.
 * @param {object[]} chunks         - Validated evidence chunks.
 * @returns {boolean}
 */
function shouldVerify(question, requestContext, answerMode, chunks) {
  // Read lazily so tests (and runtime config) can toggle without module reload
  if (String(process.env.VERIFICATION_ENABLED || 'true') === 'false') return false;

  // --- Hard skips: system-level intents ---
  if (requestContext?.intent === 'comparison') return false;
  if (requestContext?.overviewIntent) return false;
  if (requestContext?.imageQuestionType) return false;

  // document_only: user explicitly trusts the document alone
  if (answerMode === 'document_only') return false;

  const q = String(question || '');

  // --- Hard skips: question semantics ---
  if (DOCUMENT_READING_PATTERN.test(q)) return false;
  if (SKIP_QUESTION_PATTERN.test(q)) return false;

  // --- Hard skips: specification/requirements chunk content ---
  const topChunkText = (chunks || [])
    .slice(0, MAX_CHUNKS_FOR_VERIFY)
    .map((c) => String(c.promptContent || c.content || ''))
    .join('\n');
  if (SKIP_SPEC_DOC_PATTERN.test(topChunkText)) return false;

  // --- Minimum evidence threshold ---
  if (topChunkText.length < 100) return false;

  // --- Positive signal: user is asking about real-world factual accuracy ---
  // Conservative default: only verify when the question explicitly asks for it.
  return FACTUAL_CORRECTNESS_QUESTION_PATTERN.test(q);
}

// ---------------------------------------------------------------------------
// Verification prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds the system and user prompts for the verifier LLM.
 * The verifier's job is ONLY to classify evidence — it must never answer
 * the user's question or rewrite document content.
 *
 * @param {string}   question
 * @param {object[]} chunks
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildVerificationPrompts(question, chunks) {
  const chunkText = (chunks || [])
    .slice(0, MAX_CHUNKS_FOR_VERIFY)
    .map((c) => String(c.promptContent || c.content || '').slice(0, MAX_CHUNK_CHARS_FOR_VERIFY))
    .join('\n\n---\n\n');

  const questionSnippet = String(question || '').slice(0, MAX_QUESTION_CHARS_FOR_VERIFY);

  const systemPrompt = [
    'You are a factual accuracy classifier. Your ONLY job is to classify a text excerpt.',
    'You must NOT answer the user\'s question.',
    'You must NOT rewrite, correct, or quote the document.',
    'You must NOT add any prose, explanation, or markdown.',
    '',
    'Reply with EXACTLY one JSON object on a single line:',
    '{ "verdict": "verified" | "uncertain" | "contradicted", "reason": "<max 20 words>" }',
    '',
    'Verdict definitions:',
    '  "verified"     — the excerpt is consistent with widely accepted knowledge.',
    '  "uncertain"    — you cannot confirm or deny the excerpt from general knowledge.',
    '  "contradicted" — the excerpt clearly contradicts established knowledge (state why in ≤20 words).',
    '',
    'CRITICAL: output ONLY the JSON. No other text before or after it.',
  ].join('\n');

  const userPrompt = [
    'Text excerpt from a study document:',
    '"""',
    chunkText || '(no content)',
    '"""',
    '',
    'Context — the user asked:',
    '"""',
    questionSnippet || '(no question)',
    '"""',
    '',
    'Classify the factual accuracy of the text excerpt only. Do not answer the question.',
  ].join('\n');

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// JSON response parser
// ---------------------------------------------------------------------------

/**
 * Parses the verifier LLM output into a structured result.
 * Accepts only the three canonical verdict values defined in VERDICTS.
 * Returns null on any parse failure so callers can fall back safely.
 *
 * @param {string} text - Raw LLM output.
 * @returns {{ verdict: string, reason: string } | null}
 */
function parseVerificationResponse(text) {
  try {
    const cleaned = String(text || '').trim();
    // Extract the first JSON object even if the model adds surrounding prose
    const match = cleaned.match(/\{[^}]+\}/s);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    const verdict = String(parsed.verdict || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!VALID_VERDICT_SET.has(verdict)) return null;

    const reason = String(parsed.reason || '').slice(0, 200).trim();
    return { verdict, reason };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fallback result factory
// ---------------------------------------------------------------------------

/** @returns {{ verdict: string, reason: string, source: string }} */
function makeFallback(source = 'fallback') {
  return { verdict: VERDICTS.UNCERTAIN, reason: '', source };
}

// ---------------------------------------------------------------------------
// Verifier backends — pluggable interface
//
// Each backend must export a single async function:
//   verify(question: string, chunks: object[]) → { verdict, reason } | null
//
// Returning null signals failure; callers will use makeFallback().
// To swap the backend (e.g. to web-search): replace `activeVerifier` below.
// ---------------------------------------------------------------------------

/**
 * Ollama verifier backend.
 * Calls the local Qwen2.5:3b model with JSON-output mode.
 * Returns null on timeout, unavailability, or parse failure.
 */
const ollamaVerifier = {
  name: 'ollama',

  async verify(question, chunks) {
    const ollamaService = require('./ollama.service');
    const model = String(process.env.OLLAMA_MODEL || 'qwen2.5:3b');
    const { systemPrompt, userPrompt } = buildVerificationPrompts(question, chunks);

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve(null), VERIFY_TIMEOUT_MS);
    });

    const callPromise = ollamaService
      .generateChat({
        model,
        systemPrompt,
        userPrompt,
        format: 'json',
        options: { temperature: 0.0, num_predict: 80 },
      })
      .then((result) => parseVerificationResponse(result.text))
      .catch(() => null);

    return Promise.race([callPromise, timeoutPromise]);
  },
};

/**
 * The active verifier backend.
 * ─────────────────────────────────────────────────────────────────
 * TO SWITCH TO WEB-SEARCH VERIFICATION IN THE FUTURE:
 *   const webSearchVerifier = require('./verification-backends/web-search.verifier');
 *   const activeVerifier = webSearchVerifier;
 * ─────────────────────────────────────────────────────────────────
 * No other file needs to change.
 */
const activeVerifier = ollamaVerifier;

// ---------------------------------------------------------------------------
// Main verification entry point
// ---------------------------------------------------------------------------

/**
 * Runs verification using the active verifier backend.
 *
 * @param {string}   question - Cleaned user question.
 * @param {object[]} chunks   - Validated evidence chunks.
 * @returns {Promise<{ verdict: string, reason: string, source: string }>}
 */
async function verifyEvidence(question, chunks) {
  const result = await activeVerifier.verify(question, chunks);

  if (VERIFY_DEBUG) {
    console.info(`[verification] ${activeVerifier.name} result:`, result);
  }

  if (result) {
    return { ...result, source: activeVerifier.name };
  }

  return makeFallback('fallback');
}

// ---------------------------------------------------------------------------
// Safe wrapper — NEVER throws, always returns a result
// ---------------------------------------------------------------------------

/**
 * Public entry point called by ai.service.js.
 *
 * Wraps shouldVerify() + verifyEvidence() in a try/catch.
 * If verification is skipped or fails for any reason, returns
 *   { verdict: null, reason: '', source: 'skipped' | 'fallback' }
 * A null verdict means no badge will be injected into the prompt.
 *
 * @param {object} params
 * @param {string}   params.question        - Cleaned user question.
 * @param {object}   params.requestContext  - From chat-context.service.
 * @param {string}   params.answerMode      - 'hybrid' | 'document_only'.
 * @param {object[]} params.chunks          - Validated evidence chunks.
 * @returns {Promise<{ verdict: string|null, reason: string, source: string }>}
 */
async function verifyEvidenceSafe({ question, requestContext, answerMode, chunks }) {
  try {
    const gate = shouldVerify(question, requestContext, answerMode, chunks);

    if (VERIFY_DEBUG) {
      console.info('[verification] gate:', { gate, question: String(question || '').slice(0, 80) });
    }

    if (!gate) {
      return { verdict: null, reason: '', source: 'skipped' };
    }

    return await verifyEvidence(question, chunks);
  } catch (err) {
    console.error('[verification] unexpected error (swallowed):', err.message);
    return makeFallback('fallback');
  }
}

// ---------------------------------------------------------------------------
// Badge builder — advisory text injected into the main LLM system prompt
// ---------------------------------------------------------------------------

/**
 * Returns an advisory instruction string based on the verdict.
 * Returns an empty string for null verdicts (skipped) so .filter(Boolean) works.
 *
 * The badge tells the main LLM HOW to frame its answer.
 * It must never instruct the LLM to alter or omit document content.
 *
 * @param {string|null} verdict
 * @returns {string}
 */
function buildVerificationBadge(verdict) {
  if (verdict === VERDICTS.VERIFIED) {
    return [
      'Verification note: The factual claims in the retrieved evidence are CONSISTENT with established knowledge.',
      'Frame the answer confidently based on the document, e.g.: "According to the uploaded document..."',
      'Do not add uncertainty caveats that the evidence does not warrant.',
    ].join(' ');
  }

  if (verdict === VERDICTS.CONTRADICTED) {
    return [
      'Verification note: The factual claims in the retrieved evidence appear to CONTRADICT established knowledge.',
      'Present the document\'s content first, then note the discrepancy clearly.',
      'Example: "The uploaded document states X; however, this differs from generally accepted knowledge, which holds Y."',
      'Never omit or replace the document\'s content. Citations must still reference only the uploaded documents.',
    ].join(' ');
  }

  if (verdict === VERDICTS.UNCERTAIN) {
    return [
      'Verification note: The factual claims in the retrieved evidence COULD NOT be independently verified.',
      'Where appropriate, note this uncertainty briefly, e.g.: "According to the uploaded document..., though this was not independently verified."',
      'Do not over-hedge every sentence; apply judgment about where uncertainty is material.',
    ].join(' ');
  }

  // null (skipped) or unrecognised verdict: no badge
  return '';
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  VERDICTS,
  shouldVerify,
  verifyEvidence,
  verifyEvidenceSafe,
  buildVerificationBadge,
  // Exposed for unit testing internals:
  parseVerificationResponse,
  buildVerificationPrompts,
};
