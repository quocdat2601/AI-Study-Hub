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
const documentService = require('../src/services/document.service');
const embeddingService = require('../src/services/embedding.service');

const READY_TEXT = 'This imported document has enough extracted text for AI retrieval. '.repeat(4);

function sessionFixture(overrides = {}) {
  return {
    id: 35,
    user_id: 'importer-user',
    title: 'Imported shared chat',
    primary_document_id: 501,
    ...overrides,
  };
}

function documentFixture(overrides = {}) {
  return {
    id: 501,
    user_id: 'original-owner',
    title: 'Imported shared document',
    document_scope: 'shared',
    lifecycle_status: 'active',
    status: 'indexed',
    extraction_status: 'ready',
    extracted_text: READY_TEXT,
    deleted_at: null,
    cloud_files: { mime_type: 'application/pdf', storage_path: 'snapshots/demo.pdf' },
    ...overrides,
  };
}

function chunkFixture(overrides = {}) {
  return {
    id: 9001,
    doc_id: 501,
    chunk_index: 0,
    content: 'The document discusses imported shared snapshot content for study.',
    metadata: { documentId: 501, documentTitle: 'Imported shared document' },
    ...overrides,
  };
}

function mockSuccessfulAsk(t, {
  session,
  document,
  chunks = [chunkFixture()],
  vectorChunks = null,
}) {
  t.mock.method(chatModel, 'findOwnedSession', async (sessionId, userId) => (
    Number(sessionId) === Number(session.id) && String(userId) === String(session.user_id)
      ? session
      : null
  ));
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => (
    [{ session_id: session.id, doc_id: document.id, removed_at: null }]
  ));
  t.mock.method(documentModel, 'findActiveById', async (docId) => (
    Number(docId) === Number(document.id) ? document : null
  ));
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async (sessionId, role, content, metadata = {}) => ({
    id: role === 'user' ? 1 : 2,
    session_id: sessionId,
    role,
    content,
    metadata,
  }));
  t.mock.method(chatModel, 'touchSession', async () => ({}));
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => chunks);
  if (vectorChunks) {
    t.mock.method(embeddingService, 'embedQuery', async () => ({
      embedding: [0.1, 0.2, 0.3],
      model: 'test-embedding',
    }));
    t.mock.method(documentChunkModel, 'matchByEmbeddingAcrossDocuments', async () => vectorChunks);
    t.mock.method(documentChunkModel, 'matchByEmbedding', async () => vectorChunks);
  } else {
    t.mock.method(embeddingService, 'embedQuery', async () => {
      throw new Error('vector disabled in test');
    });
  }
  t.mock.method(documentModel, 'touchSessionDocuments', async () => []);
  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  }));
  t.mock.method(aiUsageService, 'assertQuota', async () => undefined);
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => undefined);
  t.mock.method(aiUsageService, 'getUsage', async () => null);
  t.mock.method(aiProviderService, 'generateAnswer', async () => ({
    answer: 'This answer used the imported shared document chunks.',
    usageMetadata: { totalTokens: 10 },
  }));
}

test('imported session owner can chat with attached shared snapshot documents', async (t) => {
  const session = sessionFixture();
  const document = documentFixture();
  const attachChecks = [];
  const authorizedChunk = chunkFixture({
    doc_id: document.id,
    metadata: { documentId: document.id, documentTitle: document.title },
  });
  const staleVectorChunk = {
    ...authorizedChunk,
    similarity: 0.91,
    metadata: {
      documentId: 12345,
      documentTitle: 'Original snapshot source',
    },
  };
  mockSuccessfulAsk(t, {
    session,
    document,
    chunks: [authorizedChunk],
    vectorChunks: [staleVectorChunk],
  });
  t.mock.method(documentService, 'canAttachDocumentToSession', async (userId, docId) => {
    attachChecks.push({ userId, docId });
    return null;
  });

  const result = await aiService.askSession({
    sessionId: session.id,
    userId: session.user_id,
    question: 'What is this imported document about?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.excludedAttachments.inaccessible, 0);
  assert.equal(result.usedRag, true);
  assert.deepEqual(result.documents.map((item) => item.id), [document.id]);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].documentId, document.id);
  assert.equal(result.sources[0].metadata.documentId, document.id);
  assert.equal(result.sources[0].documentTitle, document.title);
  assert.deepEqual(attachChecks, []);
});

test('unrelated user cannot chat with another user imported shared documents', async (t) => {
  const session = sessionFixture();
  const document = documentFixture();
  mockSuccessfulAsk(t, { session, document });

  await assert.rejects(
    aiService.askSession({
      sessionId: session.id,
      userId: 'unrelated-user',
      question: 'Summarize this',
      mode: 'hybrid',
      model: 'gemini-2.5-flash',
    }),
    /Chat session not found/
  );
});

test('imported shared documents are not reprocessed when copied chunks are missing', async (t) => {
  const session = sessionFixture();
  const document = documentFixture({ user_id: 'importer-user' });
  const findSingleChunkCalls = [];
  mockSuccessfulAsk(t, { session, document, chunks: [] });
  t.mock.method(documentService, 'canAttachDocumentToSession', async () => null);
  t.mock.method(documentChunkModel, 'findByDocumentId', async (docId) => {
    findSingleChunkCalls.push(docId);
    return [];
  });

  const result = await aiService.askSession({
    sessionId: session.id,
    userId: session.user_id,
    question: 'Summarize this imported document',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.usedRag, false);
  assert.equal(result.provider, 'system');
  assert.equal(result.excludedAttachments.inaccessible, 0);
  assert.equal(result.excludedAttachments.notIndexed, 1);
  assert.deepEqual(findSingleChunkCalls, []);
});

test('original owner library session still uses normal attachment authorization', async (t) => {
  const session = sessionFixture({ id: 44, user_id: 'original-owner', primary_document_id: 601 });
  const document = documentFixture({
    id: 601,
    user_id: 'original-owner',
    title: 'Owner library document',
    document_scope: 'library',
  });
  const chunks = [chunkFixture({
    id: 9101,
    doc_id: 601,
    metadata: { documentId: 601, documentTitle: 'Owner library document' },
  })];
  const attachChecks = [];
  mockSuccessfulAsk(t, { session, document, chunks });
  t.mock.method(documentService, 'canAttachDocumentToSession', async (userId, docId) => {
    attachChecks.push({ userId, docId });
    return document;
  });

  const result = await aiService.askSession({
    sessionId: session.id,
    userId: session.user_id,
    question: 'Summarize this owner document',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.excludedAttachments.inaccessible, 0);
  assert.deepEqual(result.documents.map((item) => item.id), [document.id]);
  assert.deepEqual(attachChecks, [{ userId: 'original-owner', docId: 601 }]);
});
