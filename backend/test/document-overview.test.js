const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
process.env.DOCUMENT_OVERVIEW_ENABLED = 'true';
process.env.DOCUMENT_OVERVIEW_PROVIDER = 'gemini';
process.env.DOCUMENT_OVERVIEW_MODEL = 'gemini-2.5-flash';

const aiService = require('../src/services/ai.service');
const aiProviderService = require('../src/services/ai-provider.service');
const aiUsageService = require('../src/services/ai-usage.service');
const chatModel = require('../src/models/chat.model');
const documentOverviewService = require('../src/services/document-overview.service');
const documentOverviewModel = require('../src/models/document-overview.model');
const documentChunkModel = require('../src/models/document-chunk.model');
const documentModel = require('../src/models/document.model');
const documentService = require('../src/services/document.service');
const documentTextService = require('../src/services/document-text.service');
const embeddingService = require('../src/services/embedding.service');
const geminiService = require('../src/services/gemini.service');
const ollamaService = require('../src/services/ollama.service');
const ragService = require('../src/services/rag.service');
const supabaseService = require('../src/services/supabase.service');

const READY_TEXT = 'Readable extracted text for overview ask tests. '.repeat(4);

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

function makeChunk(id, index, content, metadata = {}) {
  return {
    id,
    doc_id: metadata.documentId || 10,
    chunk_index: index,
    content,
    metadata,
  };
}

function setupOverviewAskMocks(t, {
  documents,
  overviews = [],
  sourceChunks = [],
  onGenerate = async ({ chunks, overviewContext }) => ({
    answer: `overview:${chunks.map((chunk) => chunk.doc_id).join(',')}:${overviewContext ? 'context' : 'no-context'}`,
    usageMetadata: { totalTokens: 10 },
  }),
}) {
  const session = { id: 55, user_id: 'user-1', primary_document_id: documents[0]?.id };
  const byId = new Map(documents.map((document) => [Number(document.id), document]));
  const messages = [];

  t.mock.method(chatModel, 'findOwnedSession', async (sessionId, userId) => (
    Number(sessionId) === session.id && userId === session.user_id ? session : null
  ));
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => (
    documents.map((document) => ({ session_id: session.id, doc_id: document.id, removed_at: null }))
  ));
  t.mock.method(documentModel, 'findActiveById', async (docId) => byId.get(Number(docId)) || null);
  t.mock.method(documentService, 'canAttachDocumentToSession', async (_userId, docId) => byId.get(Number(docId)) || null);
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async (sessionId, role, content, metadata = {}) => {
    const message = { id: messages.length + 1, session_id: sessionId, role, content, metadata };
    messages.push(message);
    return message;
  });
  t.mock.method(chatModel, 'touchSession', async () => ({}));
  t.mock.method(documentOverviewModel, 'findReadyByDocumentIds', async (docIds) => (
    overviews.filter((overview) => docIds.map(Number).includes(Number(overview.document_id)))
  ));
  t.mock.method(documentChunkModel, 'findByIds', async (ids) => (
    sourceChunks.filter((chunk) => ids.map(Number).includes(Number(chunk.id)))
  ));
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => {
    throw new Error('chunk fallback should not be reached');
  });
  t.mock.method(documentModel, 'touchSessionDocuments', async () => []);
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-2.5-flash' }));
  t.mock.method(aiUsageService, 'assertQuota', async () => undefined);
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => undefined);
  t.mock.method(aiUsageService, 'getUsage', async () => null);
  t.mock.method(aiProviderService, 'generateAnswer', onGenerate);

  return { messages };
}

function mockOverviewPersistence(t, overrides = {}) {
  const calls = {
    ready: [],
    failed: [],
    pending: [],
    stale: [],
  };

  t.mock.method(documentOverviewModel, 'findByDocumentId', overrides.findByDocumentId || (async () => null));
  t.mock.method(documentOverviewModel, 'findReusableByFileId', overrides.findReusableByFileId || (async () => null));
  t.mock.method(documentOverviewModel, 'upsertPending', async (payload) => {
    calls.pending.push(payload);
    return { ...payload, status: 'pending' };
  });
  t.mock.method(documentOverviewModel, 'markReady', async (payload) => {
    calls.ready.push(payload);
    return {
      id: 1,
      document_id: payload.documentId,
      file_id: payload.fileId,
      summary: payload.overview.summary,
      document_type: payload.overview.documentType,
      purpose: payload.overview.purpose,
      key_topics: payload.overview.keyTopics,
      outline: payload.overview.outline,
      source_chunk_ids: payload.overview.sourceChunkIds,
      status: 'ready',
      provider: payload.provider,
      model: payload.model,
    };
  });
  t.mock.method(documentOverviewModel, 'markFailed', async (payload) => {
    calls.failed.push(payload);
    return {
      id: 1,
      document_id: payload.documentId,
      file_id: payload.fileId,
      status: 'failed',
      error: String(payload.error?.message || payload.error),
    };
  });
  t.mock.method(documentOverviewModel, 'markStale', async (documentId) => {
    calls.stale.push(documentId);
    return { document_id: documentId, status: 'stale' };
  });

  return calls;
}

test('document overview migration defines schema and indexes', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/029_document_overviews.sql'),
    'utf8'
  );

  assert.match(sql, /CREATE TABLE IF NOT EXISTS document_overviews/i);
  assert.match(sql, /document_id\s+INT\s+NOT NULL\s+UNIQUE/i);
  assert.match(sql, /status\s+VARCHAR\(20\).*pending.*ready.*failed.*stale/is);
  assert.match(sql, /idx_document_overviews_file_version/i);
});

test('representative chunk selection mixes opening, headings, body, and ending', () => {
  const chunks = [
    makeChunk(1, 0, 'AI Study Hub title page. Software Requirements Specification overview and course title.'.repeat(2)),
    makeChunk(2, 1, 'Introduction: this project stores study documents and supports AI document questions.'.repeat(3), { sectionHeading: 'Introduction' }),
    makeChunk(3, 2, 'Authentication workflows for students and admins are described here.'.repeat(3), { sectionHeading: 'Authentication' }),
    makeChunk(4, 3, 'Document upload workflows include cloud files, metadata, and tags.'.repeat(3), { sectionHeading: 'Document Upload' }),
    makeChunk(5, 4, 'AI workspace workflows retrieve chunks and generate answers.'.repeat(3), { sectionHeading: 'AI Workspace' }),
    makeChunk(6, 5, 'Conclusion: the system improves learning with centralized materials.'.repeat(3), { sectionHeading: 'Conclusion' }),
  ];

  const selected = documentOverviewService.selectRepresentativeChunks(chunks, {
    maxChunks: 4,
    maxChars: 4000,
  });

  assert.equal(selected.length <= 4, true);
  assert.equal(selected.some((chunk) => chunk.chunk_index === 0), true);
  assert.equal(selected.some((chunk) => chunk.metadata.sectionHeading === 'Introduction'), true);
  assert.equal(selected.some((chunk) => chunk.metadata.sectionHeading === 'Conclusion'), true);
});

test('overview generation stores strict JSON output', async (t) => {
  const calls = mockOverviewPersistence(t);
  t.mock.method(geminiService, 'generateText', async () => ({
    model: 'gemini-2.5-flash',
    text: '```json\n{"summary":"A study hub SRS.","documentType":"SRS","purpose":"Describe requirements.","keyTopics":["RAG","uploads"],"outline":[{"heading":"Intro","summary":"Project scope"}]}\n```',
  }));

  const result = await documentOverviewService.generateOverviewForDocument({
    document: { id: 10, file_id: 99, title: 'SWP' },
    chunks: [
      makeChunk(1, 0, 'Introduction document requirements for an AI study hub.'.repeat(5)),
      makeChunk(2, 1, 'Body content describes uploads and RAG.'.repeat(5)),
    ],
  });

  assert.equal(result.status, 'ready');
  assert.equal(calls.ready.length, 1);
  assert.equal(calls.ready[0].overview.summary, 'A study hub SRS.');
  assert.deepEqual(calls.ready[0].overview.sourceChunkIds, [1, 2]);
});

test('invalid overview JSON persists failed status without throwing', async (t) => {
  const calls = mockOverviewPersistence(t);
  t.mock.method(geminiService, 'generateText', async () => ({
    model: 'gemini-2.5-flash',
    text: 'not json',
  }));

  const result = await documentOverviewService.generateOverviewForDocument({
    document: { id: 10, file_id: 99, title: 'Broken' },
    chunks: [makeChunk(1, 0, 'Useful document body content.'.repeat(10))],
  });

  assert.equal(result.status, 'failed');
  assert.equal(calls.failed.length, 1);
  assert.match(calls.failed[0].error.message, /Invalid overview JSON/);
});

test('Ollama is selected when configured and Gemini is not called', async (t) => {
  process.env.DOCUMENT_OVERVIEW_PROVIDER = 'ollama';
  process.env.DOCUMENT_OVERVIEW_MODEL = 'qwen2.5:3b';
  const calls = mockOverviewPersistence(t);
  let geminiCalled = false;
  let ollamaCalled = false;
  t.mock.method(geminiService, 'generateText', async () => {
    geminiCalled = true;
    return { model: 'gemini-2.5-flash', text: '{}' };
  });
  t.mock.method(ollamaService, 'generateChat', async ({ format, options }) => {
    ollamaCalled = true;
    assert.equal(format.type, 'object');
    assert.equal(options.temperature, 0.1);
    return {
      model: 'qwen2.5:3b',
      text: '{"summary":"Local overview","documentType":"Notes","purpose":"Study locally","keyTopics":["Qwen"],"outline":[{"heading":"Intro","description":"Local model output"}]}',
    };
  });

  const result = await documentOverviewService.generateOverviewForDocument({
    document: { id: 10, file_id: 99, title: 'Local' },
    chunks: [makeChunk(1, 0, 'Local document overview content.'.repeat(10))],
  });

  assert.equal(result.status, 'ready');
  assert.equal(ollamaCalled, true);
  assert.equal(geminiCalled, false);
  assert.equal(calls.ready[0].provider, 'ollama');
  assert.equal(calls.ready[0].model, 'qwen2.5:3b');
  process.env.DOCUMENT_OVERVIEW_PROVIDER = 'gemini';
  process.env.DOCUMENT_OVERVIEW_MODEL = 'gemini-2.5-flash';
});

test('overview parser accepts fenced JSON, surrounding text, and trailing commas', () => {
  const fenced = documentOverviewService.parseOverviewJson('```json\n{"summary":"A","documentType":"B","purpose":"C","keyTopics":["D",],"outline":[{"heading":"H","description":"I",}],}\n```');
  const surrounded = documentOverviewService.parseOverviewJson('Here is the JSON:\n{"summary":"A","documentType":"B","purpose":"C","keyTopics":["D"],"outline":[]}\nThanks');

  assert.equal(fenced.summary, 'A');
  assert.deepEqual(fenced.outline, [{ heading: 'H', description: 'I' }]);
  assert.equal(surrounded.documentType, 'B');
});

test('overview parser rejects malformed fields and completely invalid output', () => {
  assert.throws(
    () => documentOverviewService.parseOverviewJson('{"summary":123,"documentType":"B","purpose":"C","keyTopics":[],"outline":[]}'),
    /summary/
  );
  assert.throws(
    () => documentOverviewService.parseOverviewJson('not even close'),
    /Invalid overview JSON/
  );
});

test('retry uses configured Ollama provider and persists actual model', async (t) => {
  process.env.DOCUMENT_OVERVIEW_PROVIDER = 'ollama';
  process.env.DOCUMENT_OVERVIEW_MODEL = 'qwen2.5:3b';
  const calls = mockOverviewPersistence(t);
  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: 10,
    user_id: 'user-1',
    file_id: 99,
    title: 'Retry Local',
  }));
  t.mock.method(documentChunkModel, 'findByDocumentId', async () => [
    makeChunk(1, 0, 'Retry with Ollama overview generation.'.repeat(10)),
  ]);
  t.mock.method(ollamaService, 'generateChat', async () => ({
    model: 'qwen2.5:3b',
    text: '{"summary":"Retry overview","documentType":"Notes","purpose":"Retry","keyTopics":["Retry"],"outline":[]}',
  }));
  t.mock.method(geminiService, 'generateText', async () => {
    throw new Error('Gemini should not be called');
  });

  const result = await aiService.retryDocumentOverview({ id: 10, userId: 'user-1' });

  assert.equal(result.overview.status, 'ready');
  assert.equal(calls.ready[0].provider, 'ollama');
  assert.equal(calls.ready[0].model, 'qwen2.5:3b');
  process.env.DOCUMENT_OVERVIEW_PROVIDER = 'gemini';
  process.env.DOCUMENT_OVERVIEW_MODEL = 'gemini-2.5-flash';
});

test('document processing succeeds when overview generation fails', async (t) => {
  const doc = {
    id: 10,
    user_id: 'user-1',
    title: 'Business',
    file_id: 99,
    extraction_status: 'ready',
    extracted_text: 'Introduction to the business workflow. Details about study documents and AI chat.'.repeat(20),
    extraction_metadata: {},
    cloud_files: { mime_type: documentTextService.MIME_TYPES.PDF, storage_path: 'x.pdf' },
  };

  t.mock.method(documentService, 'canUseDocumentInChat', async () => doc);
  t.mock.method(ragService, 'splitTextIntoChunks', () => [
    { content: 'Business workflow and AI chat details.'.repeat(5), tokenEstimate: 50, metadata: {} },
  ]);
  t.mock.method(embeddingService, 'embedChunks', async (chunks) => chunks);
  t.mock.method(documentChunkModel, 'replaceForDocument', async () => [
    makeChunk(1, 0, 'Business workflow and AI chat details.'.repeat(5)),
  ]);
  t.mock.method(documentOverviewService, 'markStaleBestEffort', async () => ({ status: 'stale' }));
  t.mock.method(documentOverviewService, 'generateOverviewBestEffort', async () => ({ status: 'failed' }));
  t.mock.method(supabaseService, 'downloadFile', async () => Buffer.from('unused'));

  const result = await aiService.processDocument({ id: 10, userId: 'user-1' });

  assert.equal(result.status, 'ready');
  assert.equal(result.chunkCount, 1);
  assert.equal(result.overviewStatus, 'failed');
});

test('reprocessing marks previous overview stale before replacing chunks', async (t) => {
  const calls = mockOverviewPersistence(t);
  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: 10,
    user_id: 'user-1',
    title: 'Business',
    file_id: 99,
    extraction_status: 'ready',
    extracted_text: 'Overview content with enough words for chunking.'.repeat(30),
    extraction_metadata: {},
    cloud_files: { mime_type: documentTextService.MIME_TYPES.PDF, storage_path: 'x.pdf' },
  }));
  t.mock.method(ragService, 'splitTextIntoChunks', () => [
    { content: 'Overview content with enough words for chunking.'.repeat(5), tokenEstimate: 50, metadata: {} },
  ]);
  t.mock.method(embeddingService, 'embedChunks', async (chunks) => chunks);
  t.mock.method(documentChunkModel, 'replaceForDocument', async () => [
    makeChunk(1, 0, 'Overview content with enough words for chunking.'.repeat(5)),
  ]);
  t.mock.method(geminiService, 'generateText', async () => ({
    model: 'gemini-2.5-flash',
    text: '{"summary":"Ready","documentType":"Notes","purpose":"Study","keyTopics":["A"],"outline":[]}',
  }));

  await aiService.processDocument({ id: 10, userId: 'user-1' });

  assert.deepEqual(calls.stale, [10]);
  assert.equal(calls.ready.length, 1);
});

test('same file_id reuses compatible ready overview without provider call', async (t) => {
  const calls = mockOverviewPersistence(t, {
    findReusableByFileId: async () => ({
      document_id: 7,
      file_id: 99,
      summary: 'Reusable summary',
      document_type: 'Report',
      purpose: 'Explain the report',
      key_topics: ['topic'],
      outline: [{ heading: 'Intro', summary: 'Intro summary' }],
      source_chunk_ids: [701],
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    }),
  });
  t.mock.method(documentChunkModel, 'findByIds', async () => [
    { id: 701, doc_id: 7, chunk_index: 0 },
  ]);
  let providerCalled = false;
  t.mock.method(geminiService, 'generateText', async () => {
    providerCalled = true;
    return { model: 'gemini-2.5-flash', text: '{}' };
  });

  const result = await documentOverviewService.generateOverviewForDocument({
    document: { id: 10, file_id: 99, title: 'Copy' },
    chunks: [makeChunk(1001, 0, 'Same file copied chunk body.'.repeat(8))],
  });

  assert.equal(result.status, 'ready');
  assert.equal(providerCalled, false);
  assert.equal(calls.ready[0].overview.summary, 'Reusable summary');
  assert.deepEqual(calls.ready[0].overview.sourceChunkIds, [1001]);
});

test('retry endpoint requires authorization and existing chunks', async (t) => {
  t.mock.method(documentService, 'canUseDocumentInChat', async () => null);
  t.mock.method(documentModel, 'findActiveById', async () => null);

  await assert.rejects(
    aiService.retryDocumentOverview({ id: 10, userId: 'user-1' }),
    /Document not found/
  );
});

test('retry endpoint rejects duplicate fresh pending generation', async (t) => {
  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: 10,
    user_id: 'user-1',
    file_id: 99,
    title: 'Pending',
  }));
  t.mock.method(documentChunkModel, 'findByDocumentId', async () => [
    makeChunk(1, 0, 'Enough content to retry overview generation.'.repeat(8)),
  ]);
  t.mock.method(documentOverviewModel, 'findByDocumentId', async () => ({
    document_id: 10,
    status: 'pending',
    updated_at: new Date().toISOString(),
  }));

  await assert.rejects(
    aiService.retryDocumentOverview({ id: 10, userId: 'user-1' }),
    /already in progress/
  );
});

test('single-file overview uses ready overview and returns chunk citations', async (t) => {
  const doc = sessionDoc({ id: 201, title: 'Business.docx' });
  setupOverviewAskMocks(t, {
    documents: [doc],
    overviews: [{
      document_id: 201,
      summary: 'Business logic for AI Study Hub.',
      document_type: 'Business document',
      purpose: 'Explain workflows.',
      key_topics: ['users', 'documents'],
      outline: [{ heading: 'Workflow', description: 'Main app flow' }],
      source_chunk_ids: [901, 902],
    }],
    sourceChunks: [
      makeChunk(901, 0, 'Business workflow source chunk.'.repeat(100), { documentId: 201 }),
      makeChunk(902, 1, 'Document management source chunk.'.repeat(100), { documentId: 201 }),
    ],
    onGenerate: async ({ overviewContext, chunks }) => ({
      answer: `${overviewContext.includes('Business logic')}:${chunks.length}:${
        overviewContext.length + chunks.reduce((total, chunk) => total + String(chunk.promptContent || chunk.content).length, 0) <= 7000
      }`,
      usageMetadata: { totalTokens: 10 },
    }),
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'what is this file about',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
    focusedDocumentId: 201,
  });

  assert.equal(result.answer, 'true:2:true');
  assert.deepEqual(result.sources.map((source) => source.chunkId), [901, 902]);
});

test('comparison overview uses one ready overview per document with balanced sources', async (t) => {
  const docs = [
    sessionDoc({ id: 301, title: 'Thorakao.docx' }),
    sessionDoc({ id: 302, title: 'Business.docx' }),
  ];
  setupOverviewAskMocks(t, {
    documents: docs,
    overviews: [
      {
        document_id: 301,
        summary: 'Thorakao global strategy in Saudi Arabia.',
        document_type: 'Strategy report',
        purpose: 'Analyze expansion.',
        key_topics: ['Thorakao', 'Saudi Arabia'],
        outline: [],
        source_chunk_ids: [3001, 3002],
      },
      {
        document_id: 302,
        summary: 'AI Study Hub business workflows.',
        document_type: 'Business spec',
        purpose: 'Define app logic.',
        key_topics: ['AI Study Hub', 'documents'],
        outline: [],
        source_chunk_ids: [3003, 3004],
      },
    ],
    sourceChunks: [
      makeChunk(3001, 0, 'Thorakao strategy evidence.'.repeat(20), { documentId: 301 }),
      makeChunk(3002, 1, 'Saudi Arabia market evidence.'.repeat(20), { documentId: 301 }),
      makeChunk(3003, 0, 'AI Study Hub workflow evidence.'.repeat(20), { documentId: 302 }),
      makeChunk(3004, 1, 'Document management evidence.'.repeat(20), { documentId: 302 }),
    ],
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'Thorakao.docx và Business.docx có liên quan không?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.usedRag, true);
  assert.deepEqual([...new Set(result.sources.map((source) => source.documentId))], [301, 302]);
});

test('missing overview falls back to existing chunk RAG without failing', async (t) => {
  const doc = sessionDoc({ id: 401, title: 'Fallback.docx' });
  const session = { id: 55, user_id: 'user-1', primary_document_id: 401 };
  t.mock.method(chatModel, 'findOwnedSession', async () => session);
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => [{ doc_id: 401 }]);
  t.mock.method(documentModel, 'findActiveById', async () => doc);
  t.mock.method(documentService, 'canAttachDocumentToSession', async () => doc);
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async (_sessionId, role, content, metadata = {}) => ({
    id: role === 'user' ? 1 : 2,
    role,
    content,
    metadata,
  }));
  t.mock.method(chatModel, 'touchSession', async () => ({}));
  t.mock.method(documentOverviewModel, 'findReadyByDocumentIds', async () => []);
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => [
    makeChunk(4001, 0, 'Fallback chunk explains the file purpose.'.repeat(20), { documentId: 401 }),
  ]);
  t.mock.method(embeddingService, 'embedQuery', async () => {
    throw new Error('vector off');
  });
  t.mock.method(documentModel, 'touchSessionDocuments', async () => []);
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-2.5-flash' }));
  t.mock.method(aiUsageService, 'assertQuota', async () => undefined);
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => undefined);
  t.mock.method(aiUsageService, 'getUsage', async () => null);
  t.mock.method(aiProviderService, 'generateAnswer', async ({ overviewContext }) => ({
    answer: overviewContext ? 'bad' : 'fallback',
    usageMetadata: { totalTokens: 10 },
  }));

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'summarize this document',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
    focusedDocumentId: 401,
  });

  assert.equal(result.answer, 'fallback');
  assert.equal(result.sources[0].documentId, 401);
});

test('narrow factual question ignores ready overview', async (t) => {
  const doc = sessionDoc({ id: 501, title: 'Invoice.pdf' });
  setupOverviewAskMocks(t, {
    documents: [doc],
    overviews: [{
      document_id: 501,
      summary: 'Invoice overview',
      document_type: 'Invoice',
      purpose: 'Billing',
      key_topics: [],
      outline: [],
      source_chunk_ids: [5001],
    }],
    sourceChunks: [makeChunk(5001, 0, 'Invoice overview source.'.repeat(20), { documentId: 501 })],
  });
  let overviewCalled = false;
  documentOverviewModel.findReadyByDocumentIds.mock.mockImplementation(async () => {
    overviewCalled = true;
    return [];
  });
  documentChunkModel.findByDocumentIds.mock.mockImplementation(async () => [
    makeChunk(5002, 0, 'The invoice amount is 500 USD.'.repeat(20), { documentId: 501 }),
  ]);
  t.mock.method(embeddingService, 'embedQuery', async () => {
    throw new Error('vector off');
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'what is the invoice amount?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
    focusedDocumentId: 501,
  });

  assert.equal(overviewCalled, false);
  assert.equal(result.usedRag, true);
});

// ─── Regression tests for multi-document overview comparison ─────────────────

test('comparison overview: both overviews ready → uses overview path, both doc IDs in sources', async (t) => {
  const docs = [
    sessionDoc({ id: 601, title: 'TRƯỜNG ĐẠI HỌC KINH TẾ (1).docx' }),
    sessionDoc({ id: 602, title: 'Business.docx' }),
  ];
  setupOverviewAskMocks(t, {
    documents: docs,
    overviews: [
      {
        document_id: 601,
        summary: 'Thorakao global strategy analyzes entering Saudi Arabia with cosmetics distribution.',
        document_type: 'Business report',
        purpose: 'Market entry strategy.',
        key_topics: ['Thorakao', 'Saudi Arabia'],
        outline: [],
        source_chunk_ids: [6001, 6002],
      },
      {
        document_id: 602,
        summary: 'AI Study Hub business logic manages uploaded documents and chat sessions.',
        document_type: 'Business spec',
        purpose: 'Define app workflows.',
        key_topics: ['AI Study Hub', 'documents'],
        outline: [],
        source_chunk_ids: [6003, 6004],
      },
    ],
    sourceChunks: [
      makeChunk(6001, 0, 'Thorakao strategy evidence.'.repeat(20), { documentId: 601 }),
      makeChunk(6002, 1, 'Saudi Arabia market evidence.'.repeat(20), { documentId: 601 }),
      makeChunk(6003, 0, 'AI Study Hub workflow evidence.'.repeat(20), { documentId: 602 }),
      makeChunk(6004, 1, 'Document management evidence.'.repeat(20), { documentId: 602 }),
    ],
  });

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'File TRƯỜNG ĐẠI HỌC KINH TẾ và file Business nói về gì, chúng có liên quan trực tiếp với nhau không?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.usedRag, true);
  const sourceDocIds = [...new Set(result.sources.map((s) => s.documentId))].sort((a, b) => a - b);
  assert.deepEqual(sourceDocIds, [601, 602],
    'both document IDs must appear in sources when both overviews are ready');
});

test('comparison overview: one overview missing → falls back to chunks for BOTH docs, no false warning', async (t) => {
  // Doc 601 has a ready overview; doc 602 does NOT.
  // The system must fall back to chunk-based comparison with BOTH docs in scope.
  // It must NOT return "Hiện chỉ còn một tài liệu được đính kèm..."
  const docs = [
    sessionDoc({ id: 601, title: 'TRƯỜNG ĐẠI HỌC KINH TẾ (1).docx' }),
    sessionDoc({ id: 602, title: 'Business.docx' }),
  ];
  const session = { id: 55, user_id: 'user-1', primary_document_id: docs[0].id };
  const byId = new Map(docs.map((d) => [Number(d.id), d]));
  const messages = [];

  t.mock.method(chatModel, 'findOwnedSession', async () => session);
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () =>
    docs.map((d) => ({ session_id: session.id, doc_id: d.id, removed_at: null }))
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
  // Only doc 601 has a ready overview — 602 is missing
  t.mock.method(documentOverviewModel, 'findReadyByDocumentIds', async (docIds) =>
    docIds.map(Number).includes(601)
      ? [{
        document_id: 601,
        summary: 'Strategy overview.',
        document_type: 'Report',
        purpose: 'Market analysis.',
        key_topics: [],
        outline: [],
        source_chunk_ids: [6001],
      }]
      : []
  );
  // Chunk fallback returns chunks for BOTH documents
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => [
    makeChunk(6001, 0, 'Thorakao Saudi Arabia cosmetics entry strategy.'.repeat(10), { documentId: 601 }),
    makeChunk(6002, 0, 'AI Study Hub business logic document upload chat session.'.repeat(10), { documentId: 602 }),
  ]);
  t.mock.method(embeddingService, 'embedQuery', async () => { throw new Error('vector off'); });
  t.mock.method(documentModel, 'touchSessionDocuments', async () => []);
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-2.5-flash' }));
  t.mock.method(aiUsageService, 'assertQuota', async () => undefined);
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => undefined);
  t.mock.method(aiUsageService, 'getUsage', async () => null);
  t.mock.method(aiProviderService, 'generateAnswer', async () => ({
    answer: 'chunk-fallback-answer',
    usageMetadata: { totalTokens: 10 },
  }));

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'File TRƯỜNG ĐẠI HỌC KINH TẾ và file Business nói về gì, chúng có liên quan trực tiếp với nhau không?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.notEqual(
    result.answer,
    'Hiện chỉ còn một tài liệu được đính kèm nên không thể so sánh hai tài liệu.',
    'must NOT return the one-document warning when two docs are attached'
  );
  assert.equal(result.usedRag, true,
    'chunk-based RAG must be used as fallback');
  const sourceDocIds = [...new Set(result.sources.map((s) => s.documentId))].sort((a, b) => a - b);
  assert.deepEqual(sourceDocIds, [601, 602],
    'both document IDs must appear in sources even when one overview is missing');
});

test('comparison overview: one overview has empty source_chunk_ids → falls back to chunks for both docs', async (t) => {
  const docs = [
    sessionDoc({ id: 701, title: 'SWP.docx' }),
    sessionDoc({ id: 702, title: 'SRS.docx' }),
  ];
  const session = { id: 55, user_id: 'user-1', primary_document_id: docs[0].id };
  const byId = new Map(docs.map((d) => [Number(d.id), d]));
  const messages = [];

  t.mock.method(chatModel, 'findOwnedSession', async () => session);
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () =>
    docs.map((d) => ({ session_id: session.id, doc_id: d.id, removed_at: null }))
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
  // Both overviews present but doc 702 has empty source_chunk_ids
  t.mock.method(documentOverviewModel, 'findReadyByDocumentIds', async () => [
    {
      document_id: 701,
      summary: 'SWP overview.',
      document_type: 'SWP',
      purpose: 'Software project.',
      key_topics: [],
      outline: [],
      source_chunk_ids: [7001],
    },
    {
      document_id: 702,
      summary: 'SRS overview.',
      document_type: 'SRS',
      purpose: 'Software requirements.',
      key_topics: [],
      outline: [],
      source_chunk_ids: [], // empty — overview unusable
    },
  ]);
  t.mock.method(documentChunkModel, 'findByIds', async () => [
    makeChunk(7001, 0, 'SWP source chunk.'.repeat(10), { documentId: 701 }),
  ]);
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => [
    makeChunk(7001, 0, 'SWP MySQL Railway database persistence.'.repeat(8), { documentId: 701 }),
    makeChunk(7002, 0, 'SRS PostgreSQL Supabase database persistence.'.repeat(8), { documentId: 702 }),
  ]);
  t.mock.method(embeddingService, 'embedQuery', async () => { throw new Error('vector off'); });
  t.mock.method(documentModel, 'touchSessionDocuments', async () => []);
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-2.5-flash' }));
  t.mock.method(aiUsageService, 'assertQuota', async () => undefined);
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => undefined);
  t.mock.method(aiUsageService, 'getUsage', async () => null);
  t.mock.method(aiProviderService, 'generateAnswer', async () => ({
    answer: 'chunk-fallback-stale',
    usageMetadata: { totalTokens: 10 },
  }));

  const result = await aiService.askSession({
    sessionId: 55,
    userId: 'user-1',
    question: 'SWP và SRS nói về gì, chúng có liên quan trực tiếp với nhau không?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.usedRag, true);
  assert.notEqual(
    result.answer,
    'Hiện chỉ còn một tài liệu được đính kèm nên không thể so sánh hai tài liệu.',
    'must NOT return one-document warning when overview source_chunk_ids is empty'
  );
  const sourceDocIds = [...new Set(result.sources.map((s) => s.documentId))].sort((a, b) => a - b);
  assert.deepEqual(sourceDocIds, [701, 702],
    'both docs must be in sources when overview falls back due to empty source_chunk_ids');
});

