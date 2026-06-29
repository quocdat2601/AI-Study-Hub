const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const aiService = require('../src/services/ai.service');
const aiProviderService = require('../src/services/ai-provider.service');
const aiUsageService = require('../src/services/ai-usage.service');
const chatModel = require('../src/models/chat.model');
const documentChunkModel = require('../src/models/document-chunk.model');
const documentModel = require('../src/models/document.model');
const documentOverviewModel = require('../src/models/document-overview.model');
const documentService = require('../src/services/document.service');
const embeddingService = require('../src/services/embedding.service');
const rerank = require('../src/services/rag-rerank.service');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChunk(id, docId, chunkIndex, content, metadata = {}) {
  return {
    id,
    doc_id: docId,
    chunk_index: chunkIndex,
    content,
    score: 0.0,
    similarity: null,
    metadata: { documentId: docId, ...metadata },
  };
}

function neighborChunk(id, docId, chunkIndex, content, seedIndex, metadata = {}) {
  return makeChunk(id, docId, chunkIndex, content, {
    ...metadata,
    retrieval: 'neighbor_expansion',
    neighborOfChunkIndex: seedIndex,
  });
}

// ---------------------------------------------------------------------------
// Unit tests: detectQuestionRole / detectQuestionTopics
// ---------------------------------------------------------------------------

test('detectQuestionRole identifies student from question', () => {
  const tokens = rerank.detectQuestionRole(['student', 'workflow', 'upload']);
  assert.equal(tokens, 'student');
});

test('detectQuestionRole identifies admin from question', () => {
  assert.equal(rerank.detectQuestionRole(['admin', 'manage', 'system']), 'admin');
});

test('detectQuestionRole returns null when no role detected', () => {
  assert.equal(rerank.detectQuestionRole(['upload', 'file', 'storage']), null);
});

test('detectQuestionTopics identifies upload cluster', () => {
  const topics = rerank.detectQuestionTopics(['upload', 'validate', 'file']);
  assert.ok(topics.has('upload'));
});

test('detectQuestionTopics identifies SWOT cluster', () => {
  const topics = rerank.detectQuestionTopics(['swot', 'weakness', 'strength']);
  assert.ok(topics.has('swot'));
});

test('detectQuestionTopics may match multiple clusters', () => {
  const topics = rerank.detectQuestionTopics(['upload', 'auth', 'login', 'file', 'validate']);
  assert.ok(topics.has('upload'));
  assert.ok(topics.has('auth'));
});

// ---------------------------------------------------------------------------
// Unit tests: isLowInformation
// ---------------------------------------------------------------------------

test('isLowInformation rejects short content', () => {
  assert.equal(rerank.isLowInformation('...'), true);
});

test('isLowInformation rejects symbol-only content', () => {
  assert.equal(rerank.isLowInformation('--- --- 123 --- ---'), true);
});

test('isLowInformation passes substantive content', () => {
  assert.equal(rerank.isLowInformation(
    'The student uploads a document through the web interface and the system validates the file format.'
  ), false);
});

// ---------------------------------------------------------------------------
// Unit tests: rerankAndPrune
// ---------------------------------------------------------------------------

test('student workflow question excludes admin-only chunk', () => {
  const chunks = [
    makeChunk(1, 10, 0,
      'Student uploads a document through the interface. The system validates the format.',
      { sectionHeading: 'Document Upload' }
    ),
    makeChunk(2, 10, 1,
      'Admin manages and administrates users using the administrator panel and admin dashboard.',
      { sectionHeading: 'Administration' }
    ),
  ];

  const result = rerank.rerankAndPrune({
    chunks,
    question: 'How does a student upload a document?',
    scopeType: 'general',
    documentIds: [10],
  });

  // Student chunk must be selected.
  assert.ok(result.some((c) => c.id === 1), 'student upload chunk must be selected');
  // Admin chunk should either be excluded or rank after student chunk.
  if (result.some((c) => c.id === 2)) {
    const adminIdx = result.findIndex((c) => c.id === 2);
    const studentIdx = result.findIndex((c) => c.id === 1);
    assert.ok(studentIdx < adminIdx, 'student chunk must rank before admin chunk');
  }
});

test('upload question prioritizes upload/processing chunks', () => {
  const chunks = [
    makeChunk(1, 10, 0,
      'The upload endpoint validates file format, size, and MIME type before accepting the file.',
      { sectionHeading: 'File Upload' }
    ),
    makeChunk(2, 10, 1,
      'User authentication uses JWT tokens to secure all endpoints in the application.',
      { sectionHeading: 'Authentication' }
    ),
    makeChunk(3, 10, 2,
      'File storage and extraction processes the uploaded document and stores chunks.',
      { sectionHeading: 'Processing' }
    ),
  ];

  const result = rerank.rerankAndPrune({
    chunks,
    question: 'How does the system handle file upload and validation?',
    scopeType: 'general',
    documentIds: [10],
  });

  // Upload-related chunks must score higher than auth chunk.
  const uploadIdx = result.findIndex((c) => c.id === 1);
  const authIdx = result.findIndex((c) => c.id === 2);
  assert.ok(uploadIdx !== -1, 'upload chunk must be selected');
  assert.ok(uploadIdx === -1 || authIdx === -1 || uploadIdx < authIdx,
    'upload chunk must rank before auth chunk');
});

test('SWOT question prioritizes SWOT/weakness chunks', () => {
  const chunks = [
    makeChunk(1, 10, 0,
      'Weaknesses of the system include limited mobile support and dependency on cloud storage.',
      { sectionHeading: 'SWOT Analysis' }
    ),
    makeChunk(2, 10, 1,
      'The payment module handles subscription billing and invoicing for users.',
      { sectionHeading: 'Payment' }
    ),
  ];

  const result = rerank.rerankAndPrune({
    chunks,
    question: 'What are the weaknesses identified in the SWOT analysis?',
    scopeType: 'general',
    documentIds: [10],
  });

  assert.ok(result.some((c) => c.id === 1), 'SWOT chunk selected');
  if (result.some((c) => c.id === 2)) {
    assert.ok(result.findIndex((c) => c.id === 1) < result.findIndex((c) => c.id === 2),
      'SWOT chunk ranks before payment chunk');
  }
});

test('relevant neighbor is retained', () => {
  const seed = makeChunk(1, 10, 3,
    'Authentication module issues JWT tokens after validating credentials.',
    { sectionHeading: 'Authentication' }
  );
  const relevantNeighbor = neighborChunk(2, 10, 4,
    'JWT tokens expire after 24 hours and must be refreshed using the token endpoint.',
    3,
    { sectionHeading: 'Authentication' }
  );

  const result = rerank.rerankAndPrune({
    chunks: [seed, relevantNeighbor],
    question: 'How does JWT token expiry work?',
    scopeType: 'general',
    documentIds: [10],
  });

  assert.ok(result.some((c) => c.id === 2), 'relevant neighbor retained');
});

test('irrelevant neighbor is pruned when better evidence exists', () => {
  const seed = makeChunk(1, 10, 5,
    'The upload system validates MIME types and file sizes before storage and extraction.',
    { sectionHeading: 'Upload' }
  );
  // Irrelevant neighbor: unrelated topic, no keyword overlap with question.
  const irrelevantNeighbor = neighborChunk(2, 10, 6,
    'Administrator manages user accounts through the admin management panel.',
    5
  );
  // Strong competitor chunk.
  const strong = makeChunk(3, 10, 0,
    'File upload validates MIME type, file size, and extracts content for storage.',
    { sectionHeading: 'Upload' }
  );

  const result = rerank.rerankAndPrune({
    chunks: [seed, irrelevantNeighbor, strong],
    question: 'How does the upload system validate files?',
    scopeType: 'general',
    documentIds: [10],
  });

  // Irrelevant admin neighbor should rank below or be pruned.
  const adminIdx = result.findIndex((c) => c.id === 2);
  const strongIdx = result.findIndex((c) => c.id === 3);
  assert.ok(strongIdx !== -1, 'strong upload chunk selected');
  assert.ok(adminIdx === -1 || strongIdx < adminIdx,
    'irrelevant neighbor ranked below strong evidence or pruned');
});

test('near-duplicate chunks are penalized', () => {
  // Two chunks with very similar token content.
  const chunk1 = makeChunk(1, 10, 0,
    'The system validates file upload format type and size limits for each document submission.',
    { sectionHeading: 'Upload' }
  );
  const chunk2 = makeChunk(2, 10, 1,
    'The system validates file upload format type and size limits for each document.',
    { sectionHeading: 'Upload' }
  );
  const distinct = makeChunk(3, 10, 2,
    'JWT token authentication secures all upload endpoints with role-based access control.',
    { sectionHeading: 'Auth' }
  );

  const result = rerank.rerankAndPrune({
    chunks: [chunk1, chunk2, distinct],
    question: 'file upload validation',
    scopeType: 'general',
    documentIds: [10],
  });

  // Should not select both near-duplicates if the distinct chunk is also available.
  const bothDuplicates = result.some((c) => c.id === 1) && result.some((c) => c.id === 2);
  // At minimum, chunk1 must survive (it's first so gets lower near-dup penalty).
  assert.ok(result.some((c) => c.id === 1), 'first chunk of near-duplicates selected');
  // If both are selected, chunk1 must come before chunk2 (chunk1 scored first, no penalty).
  if (bothDuplicates) {
    assert.ok(result.findIndex((c) => c.id === 1) < result.findIndex((c) => c.id === 2),
      'near-duplicate is ranked after first occurrence');
  }
});

test('low-information chunk is penalized', () => {
  const lowInfo = makeChunk(1, 10, 0, '--- --- 123', {});
  const good = makeChunk(2, 10, 1,
    'The student can upload a document through the web interface for AI-powered chat.',
    { sectionHeading: 'Upload' }
  );

  const result = rerank.rerankAndPrune({
    chunks: [lowInfo, good],
    question: 'upload document',
    scopeType: 'general',
    documentIds: [10],
  });

  if (result.some((c) => c.id === 1)) {
    assert.ok(result.findIndex((c) => c.id === 2) < result.findIndex((c) => c.id === 1),
      'good chunk ranked before low-information chunk');
  } else {
    assert.ok(result.some((c) => c.id === 2), 'good chunk selected while low-info excluded');
  }
});

test('explicit multi-doc coverage is restored when reranker would drop a doc', () => {
  // Doc 10 has highly relevant content; doc 20 has lower relevance.
  // Reranker must still keep at least one chunk from doc 20.
  const doc10Chunks = [
    makeChunk(1, 10, 0, 'Upload validates MIME type for document processing storage extraction.', { sectionHeading: 'Upload' }),
    makeChunk(2, 10, 1, 'Upload validates size limits and file format before accepting file.', { sectionHeading: 'Upload' }),
    makeChunk(3, 10, 2, 'Extraction process converts PDF to text chunks for RAG retrieval system.', { sectionHeading: 'Processing' }),
    makeChunk(4, 10, 3, 'Storage uploads to cloud bucket after validation of the document format.', { sectionHeading: 'Storage' }),
  ];
  const doc20Chunk = makeChunk(10, 20, 0, 'Order form requires purchase number and vendor info.', {});

  const result = rerank.rerankAndPrune({
    chunks: [...doc10Chunks, doc20Chunk],
    question: 'How does the system handle document upload?',
    scopeType: 'explicit_multi',
    documentIds: [10, 20],
  });

  assert.ok(result.some((c) => Number(c.doc_id) === 10), 'doc 10 represented');
  assert.ok(result.some((c) => Number(c.doc_id) === 20), 'doc 20 coverage restored');
});

test('7000-character budget is enforced after reranking', () => {
  const bigContent = 'Upload validate file storage extraction. '.repeat(100); // ~4100 chars
  const chunks = [
    makeChunk(1, 10, 0, bigContent, { sectionHeading: 'Upload' }),
    makeChunk(2, 10, 1, bigContent, { sectionHeading: 'Upload' }),
  ];

  const result = rerank.rerankAndPrune({
    chunks,
    question: 'upload storage',
    scopeType: 'general',
    documentIds: [10],
  });

  const total = result.reduce((sum, c) => sum + String(c.content).length, 0);
  assert.ok(total <= rerank.MAX_CONTEXT_CHARS, `total chars ${total} must be ≤ ${rerank.MAX_CONTEXT_CHARS}`);
});

test('empty input returns empty output without error', () => {
  const result = rerank.rerankAndPrune({
    chunks: [],
    question: 'some question',
    scopeType: 'general',
    documentIds: [10],
  });
  assert.deepEqual(result, []);
});

test('rerankAndPruneSafe falls back silently on error', () => {
  // Pass null chunks — should not throw.
  const seed = makeChunk(1, 10, 0, 'Fallback test content about document upload.');
  const result = rerank.rerankAndPruneSafe({
    chunks: [seed],
    question: null,
    scopeType: 'general',
    documentIds: [10],
  });
  // Must return something (either the result or the input fallback).
  assert.ok(Array.isArray(result));
});

// ---------------------------------------------------------------------------
// Integration tests via aiService.askSession
// ---------------------------------------------------------------------------

const READY_TEXT = 'Document content for reranking integration tests. '.repeat(4);

function sessionDoc(overrides) {
  return {
    id: overrides.id,
    title: overrides.title,
    user_id: 'user-1',
    document_scope: 'session',
    origin_session_id: 55,
    lifecycle_status: 'active',
    extraction_status: 'ready',
    extracted_text: READY_TEXT,
    deleted_at: null,
    cloud_files: { mime_type: 'application/pdf', storage_path: `${overrides.title}.pdf` },
    ...overrides,
  };
}

function setupMocks(t, { documents, allChunks, onGenerate }) {
  const session = { id: 55, user_id: 'user-1', primary_document_id: documents[0]?.id };
  const byId = new Map(documents.map((d) => [Number(d.id), d]));
  const messages = [];

  t.mock.method(chatModel, 'findOwnedSession', async () => session);
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () =>
    documents.map((d) => ({ session_id: session.id, doc_id: d.id, removed_at: null }))
  );
  t.mock.method(documentModel, 'findActiveById', async (docId) => byId.get(Number(docId)) || null);
  t.mock.method(documentService, 'canAttachDocumentToSession', async (_u, docId) => byId.get(Number(docId)) || null);
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async (sid, role, content, metadata = {}) => {
    const msg = { id: messages.length + 1, session_id: sid, role, content, metadata };
    messages.push(msg);
    return msg;
  });
  t.mock.method(chatModel, 'touchSession', async () => ({}));
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => allChunks);
  t.mock.method(documentModel, 'touchSessionDocuments', async () => []);
  t.mock.method(documentOverviewModel, 'findReadyByDocumentIds', async () => []);
  t.mock.method(embeddingService, 'embedQuery', async () => { throw new Error('vector off'); });
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-2.5-flash' }));
  t.mock.method(aiUsageService, 'assertQuota', async () => undefined);
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => undefined);
  t.mock.method(aiUsageService, 'getUsage', async () => null);
  t.mock.method(aiProviderService, 'generateAnswer', onGenerate);

  return { messages };
}

test('integration: student question excludes admin-only sources', async (t) => {
  const doc = sessionDoc({ id: 10, title: 'SRS.docx' });
  let capturedDocIds;
  setupMocks(t, {
    documents: [doc],
    allChunks: [
      makeChunk(1, 10, 0,
        'Student can upload documents through the web portal interface and manage files.',
        { sectionHeading: 'Student Features' }
      ),
      makeChunk(2, 10, 1,
        'Administrator manages user accounts and administrates system settings from the admin panel.',
        { sectionHeading: 'Administration' }
      ),
      makeChunk(3, 10, 2,
        'Student can view uploaded documents, search content, and ask AI questions about files.',
        { sectionHeading: 'Student Features' }
      ),
    ],
    onGenerate: async ({ chunks }) => {
      capturedDocIds = chunks.map((c) => ({ id: c.id, docId: c.doc_id }));
      return { answer: 'answer', usageMetadata: { totalTokens: 10 } };
    },
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'What can a student do on the platform?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.usedRag, true);
  const sourceIds = result.sources.map((s) => s.chunkId);
  // Student chunks must appear.
  assert.ok(sourceIds.includes(1) || sourceIds.includes(3), 'student chunk in sources');
  // If admin chunk appears, student chunk must rank first.
  if (sourceIds.includes(2)) {
    assert.ok(sourceIds.indexOf(1) < sourceIds.indexOf(2) ||
      sourceIds.indexOf(3) < sourceIds.indexOf(2),
      'student chunk must appear before admin chunk');
  }
});

test('integration: factual retrieval is accurate — relevant chunk selected', async (t) => {
  const doc = sessionDoc({ id: 20, title: 'Business.docx' });
  setupMocks(t, {
    documents: [doc],
    allChunks: [
      makeChunk(1, 20, 0, 'General introduction to the business workflow and objectives.'),
      makeChunk(2, 20, 1, 'Upload validation requires checking MIME type, file size, and extension before accepting file submission to storage.', { sectionHeading: 'Upload' }),
      makeChunk(3, 20, 2, 'Payment and billing module handles subscriptions and monthly invoices.'),
    ],
    onGenerate: async () => ({ answer: 'answer', usageMetadata: { totalTokens: 10 } }),
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'What validation does the upload system perform?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.usedRag, true);
  // The upload chunk must be in sources.
  assert.ok(result.sources.some((s) => s.chunkId === 2), 'upload validation chunk in sources');
});

test('integration: comparison flow unchanged — no reranker applied', async (t) => {
  const doc1 = sessionDoc({ id: 301, title: 'SWP.docx' });
  const doc2 = sessionDoc({ id: 302, title: 'SRS.docx' });
  const chunks = [
    makeChunk(1, 301, 0, 'FR-05 SWP uses MySQL Railway for database persistence.', { requirementIds: ['FR-05'] }),
    makeChunk(2, 302, 0, 'FR-05 SRS uses PostgreSQL Supabase for database persistence.', { requirementIds: ['FR-05'] }),
  ];
  setupMocks(t, {
    documents: [doc1, doc2],
    allChunks: chunks,
    onGenerate: async () => ({ answer: 'comparison answer', usageMetadata: { totalTokens: 10 } }),
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'Compare SWP.docx and SRS.docx database choices',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.ok(result.comparison !== null, 'comparison metadata present');
  const docIds = [...new Set(result.sources.map((s) => s.documentId))].sort((a, b) => a - b);
  assert.deepEqual(docIds, [301, 302], 'both docs represented in comparison result');
});

test('integration: overview flow unchanged — no reranker applied', async (t) => {
  const doc = sessionDoc({ id: 401, title: 'Overview.docx' });
  const session = { id: 55, user_id: 'user-1', primary_document_id: 401 };
  const byId = new Map([[401, doc]]);
  const messages = [];

  t.mock.method(chatModel, 'findOwnedSession', async () => session);
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => [{ doc_id: 401 }]);
  t.mock.method(documentModel, 'findActiveById', async (docId) => byId.get(Number(docId)) || null);
  t.mock.method(documentService, 'canAttachDocumentToSession', async () => doc);
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async (sid, role, content, metadata = {}) => {
    const msg = { id: messages.length + 1, session_id: sid, role, content, metadata };
    messages.push(msg);
    return msg;
  });
  t.mock.method(chatModel, 'touchSession', async () => ({}));
  t.mock.method(documentOverviewModel, 'findReadyByDocumentIds', async () => [{
    document_id: 401,
    summary: 'Document overview for testing.',
    document_type: 'Report',
    purpose: 'Testing.',
    key_topics: ['testing'],
    outline: [],
    source_chunk_ids: [4001],
  }]);
  t.mock.method(documentChunkModel, 'findByIds', async () => [
    makeChunk(4001, 401, 0, 'Overview source chunk about document testing and content.'.repeat(10), { documentId: 401 }),
  ]);
  t.mock.method(documentModel, 'touchSessionDocuments', async () => []);
  t.mock.method(embeddingService, 'embedQuery', async () => { throw new Error('off'); });
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-2.5-flash' }));
  t.mock.method(aiUsageService, 'assertQuota', async () => undefined);
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => undefined);
  t.mock.method(aiUsageService, 'getUsage', async () => null);
  let overviewContextPassed = false;
  t.mock.method(aiProviderService, 'generateAnswer', async ({ overviewContext }) => {
    overviewContextPassed = !!overviewContext;
    return { answer: 'ok', usageMetadata: { totalTokens: 5 } };
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'What is this document about?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
    focusedDocumentId: 401,
  });

  assert.equal(result.usedRag, true);
  assert.ok(overviewContextPassed, 'overview context was passed to provider');
  // Reranker must not have added neighbor_expansion or other tags to overview sources.
  result.sources.forEach((s) => {
    assert.notEqual(s.metadata?.retrieval, 'neighbor_expansion');
  });
});

test('integration: source payload structure is preserved after reranking', async (t) => {
  const doc = sessionDoc({ id: 501, title: 'SWP.docx' });
  setupMocks(t, {
    documents: [doc],
    allChunks: [
      makeChunk(1, 501, 0, 'The student uploads documents through the SWP portal and management system.', { sectionHeading: 'Features', pageNumber: 2 }),
      makeChunk(2, 501, 1, 'JWT token authentication secures the upload endpoint with role validation.', { sectionHeading: 'Security', pageNumber: 3 }),
    ],
    onGenerate: async () => ({ answer: 'ok', usageMetadata: { totalTokens: 5 } }),
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'How do students upload documents?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.usedRag, true);
  for (const source of result.sources) {
    assert.ok('chunkId' in source);
    assert.ok('documentId' in source);
    assert.ok('documentTitle' in source);
    assert.ok('chunkIndex' in source);
    assert.equal(Object.isFrozen(source), true);
  }
});
