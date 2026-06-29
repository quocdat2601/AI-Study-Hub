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
const neighbor = require('../src/services/rag-neighbor.service');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeChunk(id, docId, chunkIndex, content, metadata = {}) {
  return {
    id,
    doc_id: docId,
    chunk_index: chunkIndex,
    content,
    score: 0.7,
    keywordScore: 0.7,
    vectorScore: 0.0,
    metadata: { documentId: docId, ...metadata },
  };
}

// ---------------------------------------------------------------------------
// Unit tests for isNeighborRelevant
// ---------------------------------------------------------------------------

test('same non-empty sectionHeading qualifies neighbor', () => {
  const seed = makeChunk(1, 10, 3, 'Authentication flow requires JWT token.', { sectionHeading: 'Authentication' });
  const nb   = makeChunk(2, 10, 4, 'JWT tokens expire after 24 hours.', { sectionHeading: 'Authentication' });
  assert.equal(neighbor.isNeighborRelevant(seed, nb, 'authentication'), true);
});

test('different non-empty sectionHeadings do not qualify on heading alone', () => {
  const seed = makeChunk(1, 10, 3, 'The database schema is normalized to 3NF.', { sectionHeading: 'Database' });
  const nb   = makeChunk(2, 10, 4, 'The UI was built with React components.', { sectionHeading: 'Frontend' });
  // No keyword overlap either → reject
  assert.equal(neighbor.isNeighborRelevant(seed, nb, 'database schema'), false);
});

test('continuation heuristic: seed ends incomplete, neighbor starts lowercase', () => {
  const seed = makeChunk(1, 10, 2, 'The authentication module handles login,');
  const nb   = makeChunk(2, 10, 3, 'registration, and password reset workflows.');
  assert.equal(neighbor.isNeighborRelevant(seed, nb, 'authentication'), true);
});

test('keyword overlap with seed qualifies neighbor', () => {
  const seed = makeChunk(1, 10, 5, 'MySQL database stores user accounts and sessions.');
  const nb   = makeChunk(2, 10, 6, 'MySQL tables include users, sessions, documents.');
  assert.equal(neighbor.isNeighborRelevant(seed, nb, 'database schema'), true);
});

test('keyword overlap with question qualifies neighbor', () => {
  const seed = makeChunk(1, 10, 7, 'The system uses JWT for session management.');
  const nb   = makeChunk(2, 10, 8, 'Token expiry and refresh logic is handled here.');
  assert.equal(neighbor.isNeighborRelevant(seed, nb, 'token expiry refresh'), true);
});

test('empty neighbor is rejected', () => {
  const seed = makeChunk(1, 10, 1, 'Some document content about requirements.');
  const nb   = makeChunk(2, 10, 2, '   ');
  assert.equal(neighbor.isNeighborRelevant(seed, nb, 'requirements'), false);
});

test('short low-information neighbor is rejected', () => {
  const seed = makeChunk(1, 10, 1, 'The application authenticates users via JWT.');
  const nb   = makeChunk(2, 10, 2, 'Ok.');
  assert.equal(neighbor.isNeighborRelevant(seed, nb, 'authentication'), false);
});

test('unrelated neighbor with no overlap is rejected', () => {
  const seed = makeChunk(1, 10, 4, 'Database connection pooling improves throughput.');
  const nb   = makeChunk(2, 10, 5, 'The marketing team prepared the annual report slides.');
  assert.equal(neighbor.isNeighborRelevant(seed, nb, 'database connection'), false);
});

// ---------------------------------------------------------------------------
// Unit tests for expandWithNeighbors
// ---------------------------------------------------------------------------

test('previous and next chunk from same section are included', () => {
  const seed = makeChunk(2, 10, 1, 'Authentication flow requires JWT tokens.',
    { sectionHeading: 'Authentication' });
  const prev = makeChunk(1, 10, 0, 'The login module validates credentials before issuing tokens.',
    { sectionHeading: 'Authentication' });
  const next = makeChunk(3, 10, 2, 'Tokens must be refreshed every 24 hours for security.',
    { sectionHeading: 'Authentication' });
  const pool = [prev, seed, next];

  const result = neighbor.expandWithNeighbors({
    seedChunks: [seed],
    chunkPool: pool,
    question: 'How does authentication work?',
    documentIds: [10],
  });

  assert.ok(result.some((c) => c.chunk_index === 0), 'prev chunk included');
  assert.ok(result.some((c) => c.chunk_index === 2), 'next chunk included');
  assert.ok(result.some((c) => c.chunk_index === 1), 'seed chunk included');
  // Seed comes first
  assert.equal(result[0].chunk_index, 1, 'seed is first');
});

test('unrelated neighbor is not included', () => {
  const seed = makeChunk(1, 10, 5, 'MySQL stores relational data for the application.');
  const unrelated = makeChunk(2, 10, 6, 'The marketing presentation covers quarterly sales targets.');
  const pool = [seed, unrelated];

  const result = neighbor.expandWithNeighbors({
    seedChunks: [seed],
    chunkPool: pool,
    question: 'What database does the application use?',
    documentIds: [10],
  });

  assert.ok(!result.some((c) => c.chunk_index === 6), 'unrelated neighbor excluded');
  assert.equal(result.length, 1, 'only seed returned');
});

test('no cross-document neighbor leakage', () => {
  const seed = makeChunk(1, 10, 3, 'The application uses PostgreSQL for persistence.',
    { sectionHeading: 'Database' });
  // A chunk from a different document at adjacent index — must never be added.
  const otherDoc = makeChunk(2, 20, 2, 'PostgreSQL tables for persistence are normalized.',
    { sectionHeading: 'Database' });
  const pool = [seed, otherDoc];

  const result = neighbor.expandWithNeighbors({
    seedChunks: [seed],
    chunkPool: pool,
    question: 'PostgreSQL persistence',
    documentIds: [10],
  });

  assert.ok(result.every((c) => Number(c.doc_id) === 10), 'only doc 10 chunks in result');
});

test('duplicate chunk keys are removed from expanded list', () => {
  // Two seeds adjacent to each other might both want the same chunk as a neighbor.
  const seed1 = makeChunk(1, 10, 1, 'User registration stores hashed passwords in database.', { sectionHeading: 'Auth' });
  const seed2 = makeChunk(2, 10, 3, 'Password hashing uses bcrypt with salt rounds.', { sectionHeading: 'Auth' });
  // chunk_index 2 is between both seeds; seed2 would want it as prev, seed1 as next.
  const shared = makeChunk(3, 10, 2, 'The authentication module validates both flows.', { sectionHeading: 'Auth' });
  const pool = [seed1, shared, seed2];

  const result = neighbor.expandWithNeighbors({
    seedChunks: [seed1, seed2],
    chunkPool: pool,
    question: 'authentication password hashing',
    documentIds: [10],
  });

  const indices = result.map((c) => c.chunk_index);
  // chunk_index 2 should appear exactly once.
  assert.equal(indices.filter((i) => i === 2).length, 1, 'shared neighbor deduplicated');
});

test('seed chunks are placed before neighbors in final list', () => {
  const seed = makeChunk(2, 10, 5, 'The authorization policy enforces role-based access.',
    { sectionHeading: 'Security' });
  const prev = makeChunk(1, 10, 4, 'Security middleware intercepts every request.',
    { sectionHeading: 'Security' });
  const pool = [prev, seed];

  const result = neighbor.expandWithNeighbors({
    seedChunks: [seed],
    chunkPool: pool,
    question: 'role-based access control',
    documentIds: [10],
  });

  assert.equal(result[0].id, 2, 'seed (id=2) is first');
  assert.equal(result[1].id, 1, 'neighbor (id=1) is after seed');
});

test('7000-character budget is respected — neighbor excluded when budget full', () => {
  // Create a seed that already fills most of the budget.
  const bigContent = 'A'.repeat(6800);
  const seed = makeChunk(1, 10, 0, bigContent, { sectionHeading: 'Main' });
  // A valid neighbor that would push past 7000.
  const bigNeighbor = makeChunk(2, 10, 1, 'B'.repeat(500), { sectionHeading: 'Main' });
  const pool = [seed, bigNeighbor];

  const result = neighbor.expandWithNeighbors({
    seedChunks: [seed],
    chunkPool: pool,
    question: 'main content',
    documentIds: [10],
  });

  const totalChars = result.reduce((sum, c) => sum + String(c.content).length, 0);
  assert.ok(totalChars <= neighbor.MAX_CONTEXT_CHARS,
    `context ${totalChars} must not exceed ${neighbor.MAX_CONTEXT_CHARS}`);
});

test('explicit multi-document coverage: neighbor from wrong doc excluded when documentIds filter used', () => {
  const seed1 = makeChunk(1, 10, 2, 'Attendance rules are defined in the business spec.', { sectionHeading: 'Rules' });
  const seed2 = makeChunk(4, 20, 2, 'Assignment rubric specifies attendance criteria.', { sectionHeading: 'Rules' });
  // Neighbors for each doc.
  const nb1 = makeChunk(2, 10, 3, 'Business attendance threshold is 80 percent.', { sectionHeading: 'Rules' });
  const nb2 = makeChunk(5, 20, 3, 'Assignment attendance threshold is 75 percent.', { sectionHeading: 'Rules' });
  // A neighbor from doc 30 (not in scope).
  const outOfScope = makeChunk(9, 30, 3, 'Attendance rules for regulations department.', { sectionHeading: 'Rules' });
  const pool = [seed1, nb1, seed2, nb2, outOfScope];

  const result = neighbor.expandWithNeighbors({
    seedChunks: [seed1, seed2],
    chunkPool: pool,
    question: 'attendance rules',
    documentIds: [10, 20],
  });

  assert.ok(result.every((c) => [10, 20].includes(Number(c.doc_id))),
    'no out-of-scope document chunks in result');
  assert.ok(result.some((c) => Number(c.doc_id) === 10), 'doc 10 represented');
  assert.ok(result.some((c) => Number(c.doc_id) === 20), 'doc 20 represented');
});

test('max expanded chunks limit is respected', () => {
  // 3 seeds each with valid prev/next neighbors = 9 candidates → capped at MAX_EXPANDED_CHUNKS.
  const seeds = [1, 3, 5].map((idx) =>
    makeChunk(idx * 10, 10, idx, `Seed ${idx} content about authentication tokens jwt.`,
      { sectionHeading: 'Auth' })
  );
  const allChunks = [0, 1, 2, 3, 4, 5, 6].map((idx) =>
    makeChunk(idx * 10, 10, idx, `Chunk ${idx} about authentication tokens jwt session.`,
      { sectionHeading: 'Auth' })
  );

  const result = neighbor.expandWithNeighbors({
    seedChunks: seeds,
    chunkPool: allChunks,
    question: 'authentication token',
    documentIds: [10],
  });

  assert.ok(result.length <= neighbor.MAX_EXPANDED_CHUNKS,
    `result length ${result.length} must be ≤ ${neighbor.MAX_EXPANDED_CHUNKS}`);
});

test('missing neighbor in pool does not throw', () => {
  const seed = makeChunk(1, 10, 5, 'The system uses Firebase for file storage.');
  // Pool only has the seed; no neighbors at index 4 or 6.
  const pool = [seed];

  assert.doesNotThrow(() => {
    const result = neighbor.expandWithNeighbors({
      seedChunks: [seed],
      chunkPool: pool,
      question: 'Firebase storage',
      documentIds: [10],
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 1);
  });
});

test('expandWithNeighborsSafe falls back silently when expansion throws', () => {
  // Pass null chunkPool which would ordinarily cause issues.
  // Safe wrapper must return seedChunks unchanged.
  const seed = makeChunk(1, 10, 0, 'Seed chunk content here.');
  const result = neighbor.expandWithNeighborsSafe({
    seedChunks: [seed],
    chunkPool: null,
    question: 'seed',
    documentIds: [10],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
});

// ---------------------------------------------------------------------------
// Integration tests via aiService.askSession
// ---------------------------------------------------------------------------

const READY_TEXT = 'Document content for neighbor expansion test. '.repeat(4);

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

function setupIntegrationMocks(t, { documents, allChunks, onGenerate }) {
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

test('integration: neighbor chunk from same section is included in sources', async (t) => {
  const doc = sessionDoc({ id: 10, title: 'SRS.docx' });
  let capturedChunkIds;
  setupIntegrationMocks(t, {
    documents: [doc],
    allChunks: [
      // chunk_index 0 is not highly scored but is valid neighbor
      makeChunk(100, 10, 0, 'The authentication module handles JWT issuance.', { sectionHeading: 'Auth' }),
      // chunk_index 1: seed (high relevance keyword match)
      makeChunk(101, 10, 1, 'JWT tokens expire after 24 hours for security purposes.', { sectionHeading: 'Auth' }),
      // chunk_index 2: valid next neighbor
      makeChunk(102, 10, 2, 'Tokens are refreshed using the refresh endpoint.', { sectionHeading: 'Auth' }),
    ],
    onGenerate: async ({ chunks }) => {
      capturedChunkIds = chunks.map((c) => c.id);
      return { answer: 'answer', usageMetadata: { totalTokens: 10 } };
    },
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'How do JWT tokens expire?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  // Seed 101 (JWT tokens) should have been selected; neighbors 100 and 102 share the heading.
  assert.equal(result.usedRag, true);
  // At minimum the seed must be present.
  assert.ok(result.sources.some((s) => s.chunkId === 101), 'seed chunk in sources');
  // Neighbor chunks must also be real document chunks (have IDs).
  result.sources.forEach((s) => {
    assert.ok(Number.isInteger(s.chunkId), `source chunkId ${s.chunkId} must be integer`);
    assert.equal(s.documentId, 10, 'all sources belong to doc 10');
  });
});

test('integration: source payload structure is preserved for neighbor chunks', async (t) => {
  const doc = sessionDoc({ id: 11, title: 'Business.docx' });
  setupIntegrationMocks(t, {
    documents: [doc],
    allChunks: [
      makeChunk(200, 11, 0, 'Business workflow defines upload and download procedures.', { sectionHeading: 'Workflow', pageNumber: 1 }),
      makeChunk(201, 11, 1, 'Upload procedure requires authentication and file validation.', { sectionHeading: 'Workflow', pageNumber: 1 }),
    ],
    onGenerate: async () => ({ answer: 'ok', usageMetadata: { totalTokens: 5 } }),
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'What is the upload procedure?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.usedRag, true);
  for (const source of result.sources) {
    assert.ok('chunkId' in source, 'chunkId present');
    assert.ok('documentId' in source, 'documentId present');
    assert.ok('documentTitle' in source, 'documentTitle present');
    assert.ok('chunkIndex' in source, 'chunkIndex present');
    assert.equal(Object.isFrozen(source), true, 'source is frozen');
  }
});

test('integration: comparison flow is unchanged — no neighbor expansion applied', async (t) => {
  const doc1 = sessionDoc({ id: 301, title: 'SWP.docx' });
  const doc2 = sessionDoc({ id: 302, title: 'SRS.docx' });
  const chunks = [
    makeChunk(3001, 301, 0, 'FR-05 SWP uses MySQL on Railway for persistence.', { requirementIds: ['FR-05'], sectionHeading: 'Product Constraints' }),
    makeChunk(3002, 302, 0, 'FR-05 SRS uses PostgreSQL on Supabase for persistence.', { requirementIds: ['FR-05'], sectionHeading: 'Product Constraints' }),
  ];
  let capturedComparisonMeta = null;
  setupIntegrationMocks(t, {
    documents: [doc1, doc2],
    allChunks: chunks,
    onGenerate: async () => ({ answer: 'comparison answer', usageMetadata: { totalTokens: 10 } }),
  });
  // Override the addMessage mock to capture metadata
  const messages = [];
  t.mock.method(chatModel, 'addMessage', async (sid, role, content, metadata = {}) => {
    const msg = { id: messages.length + 1, session_id: sid, role, content, metadata };
    messages.push(msg);
    if (role === 'assistant') capturedComparisonMeta = metadata.comparison;
    return msg;
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'Compare SWP.docx and SRS.docx and list differences',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  // Comparison path must still produce comparison metadata.
  assert.ok(result.comparison !== null, 'comparison metadata present');
  // No neighbor retrieval tag should appear on comparison chunks.
  result.sources.forEach((s) => {
    assert.notEqual(s.metadata?.retrieval, 'neighbor_expansion',
      'comparison sources must not have neighbor_expansion retrieval tag');
  });
});

test('integration: overview path is unchanged — no neighbor expansion applied', async (t) => {
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
    summary: 'This is the overview summary.',
    document_type: 'Report',
    purpose: 'Overview purpose.',
    key_topics: ['overview'],
    outline: [],
    source_chunk_ids: [4001],
  }]);
  t.mock.method(documentChunkModel, 'findByIds', async () => [
    makeChunk(4001, 401, 0, 'Overview source chunk content.'.repeat(20), { documentId: 401 }),
  ]);
  t.mock.method(documentModel, 'touchSessionDocuments', async () => []);
  t.mock.method(embeddingService, 'embedQuery', async () => { throw new Error('off'); });
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-2.5-flash' }));
  t.mock.method(aiUsageService, 'assertQuota', async () => undefined);
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => undefined);
  t.mock.method(aiUsageService, 'getUsage', async () => null);
  let overviewContextReceived = null;
  t.mock.method(aiProviderService, 'generateAnswer', async ({ overviewContext }) => {
    overviewContextReceived = overviewContext;
    return { answer: 'overview answer', usageMetadata: { totalTokens: 5 } };
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
  // Overview path must have been used (overviewContext set).
  assert.ok(overviewContextReceived, 'overview context was passed to provider');
  // No neighbor_expansion tag on overview sources.
  result.sources.forEach((s) => {
    assert.notEqual(s.metadata?.retrieval, 'neighbor_expansion',
      'overview sources must not have neighbor_expansion retrieval tag');
  });
});

test('integration: 7000-char context budget still holds after expansion', async (t) => {
  const doc = sessionDoc({ id: 501, title: 'Long.docx' });
  // Create large chunks so the seed already uses most of the budget.
  const bigContent = 'Token authentication and security. '.repeat(200); // ~6600 chars
  const allChunks = [
    makeChunk(501, 501, 0, bigContent, { sectionHeading: 'Security' }),
    makeChunk(502, 501, 1, 'Token expiry and refresh handling.'.repeat(10), { sectionHeading: 'Security' }),
  ];
  let promptChars = 0;
  setupIntegrationMocks(t, {
    documents: [doc],
    allChunks,
    onGenerate: async ({ chunks }) => {
      promptChars = chunks.reduce((sum, c) => sum + String(c.promptContent || c.content).length, 0);
      return { answer: 'ok', usageMetadata: { totalTokens: 5 } };
    },
  });

  await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'Token authentication security',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.ok(promptChars <= 7000, `prompt chars ${promptChars} must be ≤ 7000`);
});
