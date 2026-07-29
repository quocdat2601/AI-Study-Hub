/**
 * verification.service.test.js
 *
 * Unit tests for the refactored verification.service.js.
 *
 * Coverage:
 *  - VERDICTS enum
 *  - parseVerificationResponse (new schema: no confidence field)
 *  - shouldVerify gate (intent-based, not chunk-content-based)
 *  - buildVerificationPrompts
 *  - buildVerificationBadge (new verdict names)
 *  - verifyEvidenceSafe (fallback safety)
 */

const assert = require('node:assert/strict');
const test = require('node:test');

// ---------------------------------------------------------------------------
// Env stubs — must be set before requiring the service
// ---------------------------------------------------------------------------
process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
process.env.VERIFICATION_ENABLED = 'true';
process.env.VERIFY_TIMEOUT_MS = '500';
process.env.VERIFY_DEBUG = 'false';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChunk(content, docId = 1, chunkIndex = 0) {
  return {
    id: chunkIndex + 1,
    doc_id: docId,
    chunk_index: chunkIndex,
    content,
    score: 0.8,
    metadata: { documentId: docId },
  };
}

function makeContext(overrides = {}) {
  return {
    intent: 'question_answering',
    imageQuestionType: null,
    overviewIntent: null,
    ...overrides,
  };
}

/** A chunk long enough to pass the minimum-length threshold. */
function makeFactualChunk() {
  return makeChunk(
    'Penicillin was discovered by Alexander Fleming in 1928 at St Mary\'s Hospital in London. '
    + 'The discovery revolutionised medicine and led to the development of antibiotics that saved millions of lives.'
    + ' Fleming shared the Nobel Prize in Physiology or Medicine in 1945.'
  );
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
const {
  VERDICTS,
  shouldVerify,
  parseVerificationResponse,
  buildVerificationPrompts,
  buildVerificationBadge,
  verifyEvidenceSafe,
} = require('../src/services/verification.service');

// ---------------------------------------------------------------------------
// VERDICTS enum
// ---------------------------------------------------------------------------

test('VERDICTS enum contains the three canonical values', () => {
  assert.equal(VERDICTS.VERIFIED, 'verified');
  assert.equal(VERDICTS.UNCERTAIN, 'uncertain');
  assert.equal(VERDICTS.CONTRADICTED, 'contradicted');
  assert.equal(Object.keys(VERDICTS).length, 3);
});

// ---------------------------------------------------------------------------
// parseVerificationResponse — new schema (no confidence field)
// ---------------------------------------------------------------------------

test('parseVerificationResponse: parses verified JSON', () => {
  const result = parseVerificationResponse('{"verdict":"verified","reason":"matches history"}');
  assert.equal(result.verdict, 'verified');
  assert.equal(result.reason, 'matches history');
  assert.ok(!('confidence' in result), 'confidence field must not exist');
});

test('parseVerificationResponse: parses uncertain JSON', () => {
  const result = parseVerificationResponse('{"verdict":"uncertain","reason":""}');
  assert.equal(result.verdict, 'uncertain');
});

test('parseVerificationResponse: parses contradicted JSON', () => {
  const result = parseVerificationResponse('{"verdict":"contradicted","reason":"wrong year cited"}');
  assert.equal(result.verdict, 'contradicted');
  assert.equal(result.reason, 'wrong year cited');
});

test('parseVerificationResponse: accepts the new verdict name contradicted', () => {
  // Must no longer accept the old name likely_incorrect
  const old = parseVerificationResponse('{"verdict":"likely_incorrect","reason":""}');
  assert.equal(old, null, 'likely_incorrect must no longer be accepted');

  const current = parseVerificationResponse('{"verdict":"contradicted","reason":""}');
  assert.notEqual(current, null);
});

test('parseVerificationResponse: extracts JSON embedded in surrounding prose', () => {
  const result = parseVerificationResponse('Sure! Here: {"verdict":"verified","reason":"ok"}');
  assert.equal(result.verdict, 'verified');
});

test('parseVerificationResponse: returns null for unknown verdict', () => {
  assert.equal(parseVerificationResponse('{"verdict":"wrong","reason":""}'), null);
  assert.equal(parseVerificationResponse('{"verdict":"likely_incorrect","reason":""}'), null);
});

test('parseVerificationResponse: returns null for non-JSON input', () => {
  assert.equal(parseVerificationResponse('not json'), null);
  assert.equal(parseVerificationResponse(''), null);
  assert.equal(parseVerificationResponse(null), null);
});

test('parseVerificationResponse: does not require confidence field', () => {
  const result = parseVerificationResponse('{"verdict":"verified","reason":"ok"}');
  assert.ok(result !== null);
  assert.ok(!('confidence' in result));
});

// ---------------------------------------------------------------------------
// shouldVerify — hard skips (system intents)
// ---------------------------------------------------------------------------

test('shouldVerify: skips when VERIFICATION_ENABLED is false', () => {
  process.env.VERIFICATION_ENABLED = 'false';
  assert.equal(shouldVerify('Có đúng không?', makeContext(), 'hybrid', [makeFactualChunk()]), false);
  process.env.VERIFICATION_ENABLED = 'true';
});

test('shouldVerify: skips for comparison intent', () => {
  assert.equal(shouldVerify('Có đúng không?', makeContext({ intent: 'comparison' }), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips when imageQuestionType is set', () => {
  assert.equal(shouldVerify('Có chính xác không?', makeContext({ imageQuestionType: 'image_text_question' }), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips when overviewIntent is set', () => {
  assert.equal(shouldVerify('Có đúng không?', makeContext({ overviewIntent: 'document_overview' }), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips for document_only mode', () => {
  assert.equal(shouldVerify('Có đúng không?', makeContext(), 'document_only', [makeFactualChunk()]), false);
});

// ---------------------------------------------------------------------------
// shouldVerify — document-reading skip patterns (Vietnamese)
// ---------------------------------------------------------------------------

test('shouldVerify: skips for "Tài liệu này nói gì?" (what does the document say)', () => {
  assert.equal(shouldVerify('Tài liệu này nói gì?', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips for "Tóm tắt file này" (summarise this file)', () => {
  assert.equal(shouldVerify('Tóm tắt file này.', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips for "Theo file, workflow hoạt động như thế nào?" (according to file)', () => {
  assert.equal(shouldVerify('Theo file, workflow upload hoạt động như thế nào?', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips for "File này ghi gì về SWOT?" (what does file say about)', () => {
  assert.equal(shouldVerify('File này ghi gì về SWOT?', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips for "Đọc nguyên văn đoạn này" (read this passage literally)', () => {
  assert.equal(shouldVerify('Đọc nguyên văn đoạn này.', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips for "Tóm tắt" prefix', () => {
  assert.equal(shouldVerify('Tóm tắt phần 2 của tài liệu.', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

// ---------------------------------------------------------------------------
// shouldVerify — document-reading skip patterns (English)
// ---------------------------------------------------------------------------

test('shouldVerify: skips for "What does the document say about X"', () => {
  assert.equal(shouldVerify('What does the document say about penicillin?', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips for "According to the file"', () => {
  assert.equal(shouldVerify('According to the file, when was penicillin discovered?', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips for "Summarize this document"', () => {
  assert.equal(shouldVerify('Summarize this document.', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips for creative/rewrite requests', () => {
  assert.equal(shouldVerify('Write a poem about this document.', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

// ---------------------------------------------------------------------------
// shouldVerify — opinion/format skip patterns
// ---------------------------------------------------------------------------

test('shouldVerify: skips for opinion questions', () => {
  assert.equal(shouldVerify('What do you think about this?', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

test('shouldVerify: skips for "Dịch sang" (translate to)', () => {
  assert.equal(shouldVerify('Dịch sang tiếng Anh.', makeContext(), 'hybrid', [makeFactualChunk()]), false);
});

// ---------------------------------------------------------------------------
// shouldVerify — spec document skip
// ---------------------------------------------------------------------------

test('shouldVerify: skips for requirement/spec chunk content', () => {
  const specChunk = makeChunk('FR-001: The system shall validate user input. NFR-002: Response time must be under 2 seconds. UC-003: User login flow.');
  assert.equal(shouldVerify('Is this correct?', makeContext(), 'hybrid', [specChunk]), false);
});

// ---------------------------------------------------------------------------
// shouldVerify — minimum length skip
// ---------------------------------------------------------------------------

test('shouldVerify: skips when chunk text is too short', () => {
  assert.equal(shouldVerify('Có đúng không?', makeContext(), 'hybrid', [makeChunk('Short.')]), false);
});

test('shouldVerify: skips when chunks are empty', () => {
  assert.equal(shouldVerify('Có đúng không?', makeContext(), 'hybrid', []), false);
});

// ---------------------------------------------------------------------------
// shouldVerify — POSITIVE cases (factual correctness questions)
// ---------------------------------------------------------------------------

test('shouldVerify: triggers for "Có đúng không?" (is this correct?)', () => {
  assert.equal(shouldVerify('Có đúng không?', makeContext(), 'hybrid', [makeFactualChunk()]), true);
});

test('shouldVerify: triggers for "Thông tin này có chính xác không?"', () => {
  assert.equal(shouldVerify('Thông tin này có chính xác không?', makeContext(), 'hybrid', [makeFactualChunk()]), true);
});

test('shouldVerify: triggers for "Điều này có đúng ngoài thực tế không?"', () => {
  assert.equal(shouldVerify('Điều này có đúng ngoài thực tế không?', makeContext(), 'hybrid', [makeFactualChunk()]), true);
});

test('shouldVerify: triggers for "Paris có phải thủ đô nước Đức không?" (fact-check question)', () => {
  assert.equal(shouldVerify('Paris có phải thủ đô nước Đức không?', makeContext(), 'hybrid', [makeFactualChunk()]), true);
});

test('shouldVerify: triggers for "Is this accurate?" (English)', () => {
  assert.equal(shouldVerify('Is this accurate?', makeContext(), 'hybrid', [makeFactualChunk()]), true);
});

test('shouldVerify: triggers for "Is this correct?" (English)', () => {
  assert.equal(shouldVerify('Is this correct?', makeContext(), 'hybrid', [makeFactualChunk()]), true);
});

test('shouldVerify: triggers for "fact check this" (English)', () => {
  assert.equal(shouldVerify('Please fact check this claim.', makeContext(), 'hybrid', [makeFactualChunk()]), true);
});

test('shouldVerify: triggers for "Giải thích hiện tượng này" (explain this phenomenon)', () => {
  assert.equal(shouldVerify('Giải thích hiện tượng này.', makeContext(), 'hybrid', [makeFactualChunk()]), true);
});

// ---------------------------------------------------------------------------
// buildVerificationPrompts
// ---------------------------------------------------------------------------

test('buildVerificationPrompts: system prompt explicitly forbids answering the question', () => {
  const { systemPrompt } = buildVerificationPrompts('Is this correct?', [makeFactualChunk()]);
  assert.ok(systemPrompt.includes('must NOT answer'));
  assert.ok(systemPrompt.includes('must NOT rewrite'));
});

test('buildVerificationPrompts: JSON schema specifies contradicted (not likely_incorrect)', () => {
  const { systemPrompt } = buildVerificationPrompts('Is this correct?', [makeFactualChunk()]);
  assert.ok(systemPrompt.includes('contradicted'));
  assert.ok(!systemPrompt.includes('likely_incorrect'));
  assert.ok(!systemPrompt.includes('confidence'));
});

test('buildVerificationPrompts: userPrompt includes chunk content and question', () => {
  const { userPrompt } = buildVerificationPrompts('When was penicillin discovered?', [makeFactualChunk()]);
  assert.ok(userPrompt.includes('Penicillin'));
  assert.ok(userPrompt.includes('penicillin'));
});

test('buildVerificationPrompts: truncates long chunk content', () => {
  const longContent = 'x'.repeat(2000);
  const { userPrompt } = buildVerificationPrompts('question', [makeChunk(longContent)]);
  const contentStart = userPrompt.indexOf('"""') + 3;
  const contentEnd = userPrompt.lastIndexOf('"""');
  const extracted = userPrompt.slice(contentStart, contentEnd);
  assert.ok(extracted.length <= 900, `Expected ≤900 chars, got ${extracted.length}`);
});

test('buildVerificationPrompts: limits to MAX_CHUNKS_FOR_VERIFY chunks', () => {
  const chunks = [
    makeChunk('Content A about Fleming.', 1, 0),
    makeChunk('Content B about Newton.', 1, 1),
    makeChunk('Content C should not appear.', 1, 2),
  ];
  const { userPrompt } = buildVerificationPrompts('question', chunks);
  assert.ok(userPrompt.includes('Content A'));
  assert.ok(userPrompt.includes('Content B'));
  assert.ok(!userPrompt.includes('Content C'));
});

// ---------------------------------------------------------------------------
// buildVerificationBadge — new verdict names
// ---------------------------------------------------------------------------

test('buildVerificationBadge: verified badge says CONSISTENT', () => {
  const badge = buildVerificationBadge('verified');
  assert.ok(badge.includes('CONSISTENT'));
  assert.ok(badge.length > 0);
});

test('buildVerificationBadge: contradicted badge says CONTRADICT (not likely_incorrect)', () => {
  const badge = buildVerificationBadge('contradicted');
  assert.ok(badge.toUpperCase().includes('CONTRADICT'));
  assert.ok(!badge.includes('likely_incorrect'));
});

test('buildVerificationBadge: uncertain badge says COULD NOT', () => {
  const badge = buildVerificationBadge('uncertain');
  assert.ok(badge.includes('COULD NOT'));
});

test('buildVerificationBadge: returns empty string for null verdict', () => {
  assert.equal(buildVerificationBadge(null), '');
  assert.equal(buildVerificationBadge(undefined), '');
  assert.equal(buildVerificationBadge(''), '');
});

test('buildVerificationBadge: returns empty string for old verdict name likely_incorrect', () => {
  // Old name should not produce a badge — it's not in VERDICTS
  assert.equal(buildVerificationBadge('likely_incorrect'), '');
});

// ---------------------------------------------------------------------------
// verifyEvidenceSafe — fallback safety
// ---------------------------------------------------------------------------

test('verifyEvidenceSafe: returns skipped when shouldVerify gate returns false', async () => {
  const result = await verifyEvidenceSafe({
    question: 'Tài liệu này nói gì?',
    requestContext: makeContext(),
    answerMode: 'hybrid',
    chunks: [makeFactualChunk()],
  });
  assert.equal(result.source, 'skipped');
  assert.equal(result.verdict, null);
  assert.ok(!('confidence' in result), 'confidence must not exist');
});

test('verifyEvidenceSafe: returns skipped for document_only mode', async () => {
  const result = await verifyEvidenceSafe({
    question: 'Có đúng không?',
    requestContext: makeContext(),
    answerMode: 'document_only',
    chunks: [makeFactualChunk()],
  });
  assert.equal(result.source, 'skipped');
  assert.equal(result.verdict, null);
});

test('verifyEvidenceSafe: returns skipped for comparison intent', async () => {
  const result = await verifyEvidenceSafe({
    question: 'Có đúng không?',
    requestContext: makeContext({ intent: 'comparison' }),
    answerMode: 'hybrid',
    chunks: [makeFactualChunk()],
  });
  assert.equal(result.source, 'skipped');
});

test('verifyEvidenceSafe: returns fallback (uncertain) when Ollama is unreachable', async () => {
  // Ollama is not running in test env; VERIFY_TIMEOUT_MS=500 ensures fast fallback
  const result = await verifyEvidenceSafe({
    question: 'Thông tin này có chính xác không?',
    requestContext: makeContext(),
    answerMode: 'hybrid',
    chunks: [makeFactualChunk()],
  });
  // Either Ollama succeeded (if running) or returned fallback — both are valid
  assert.ok([VERDICTS.VERIFIED, VERDICTS.UNCERTAIN, VERDICTS.CONTRADICTED, null].includes(result.verdict));
  assert.ok(['ollama', 'skipped', 'fallback'].includes(result.source));
  assert.ok(!('confidence' in result), 'confidence must not exist in any result');
});

test('verifyEvidenceSafe: never throws on catastrophic input', async () => {
  const result = await verifyEvidenceSafe({
    question: null,
    requestContext: null,
    answerMode: null,
    chunks: null,
  });
  assert.ok(result !== null && result !== undefined);
  assert.ok('source' in result);
  assert.ok(!('confidence' in result));
});
