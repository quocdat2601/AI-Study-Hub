const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
process.env.GEMINI_API_KEY ||= 'test-api-key';

const aiService = require('../src/services/ai.service');
const aiProviderService = require('../src/services/ai-provider.service');
const aiUsageService = require('../src/services/ai-usage.service');
const chatContext = require('../src/services/chat-context.service');
const chatModel = require('../src/models/chat.model');
const documentChunkModel = require('../src/models/document-chunk.model');
const documentModel = require('../src/models/document.model');
const documentService = require('../src/services/document.service');
const embeddingService = require('../src/services/embedding.service');

const READY_TEXT = 'Readable extracted text for adaptive targeting tests. '.repeat(4);

function doc(overrides) {
  return {
    user_id: 'student-1',
    document_scope: 'session',
    lifecycle_status: 'active',
    status: 'indexed',
    extraction_status: 'ready',
    extracted_text: READY_TEXT,
    deleted_at: null,
    cloud_files: { mime_type: 'application/pdf', storage_path: `user-1/${overrides.title || overrides.id}.pdf` },
    ...overrides,
  };
}

function chunk(id, docId, content, score = 0.7) {
  return {
    id,
    doc_id: docId,
    chunk_index: 0,
    content,
    score,
    metadata: { documentId: docId },
  };
}

const docs = [
  doc({ id: 101, title: 'Business.docx', origin_session_id: 77 }),
  doc({ id: 102, title: 'Order_305.pdf', origin_session_id: 77 }),
  doc({ id: 103, title: '530_asm1.docx', origin_session_id: 77 }),
];

function setupAskMocks(t, {
  documents = docs,
  chunks,
  vectorThrows = true,
  onGenerate = async ({ chunks: promptChunks }) => ({
    answer: `used:${promptChunks.map((item) => item.doc_id).join(',')}`,
    usageMetadata: { totalTokens: 10 },
  }),
  onAssertQuota = async () => undefined,
} = {}) {
  const session = { id: 77, user_id: 'student-1', primary_document_id: 101 };
  const byId = new Map(documents.map((item) => [Number(item.id), item]));
  const addMessages = [];

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
    const message = { id: addMessages.length + 1, session_id: sessionId, role, content, metadata };
    addMessages.push(message);
    return message;
  });
  t.mock.method(chatModel, 'touchSession', async () => ({}));
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => chunks || []);
  t.mock.method(documentChunkModel, 'findByDocumentId', async (id) => (chunks || []).filter(c => Number(c.doc_id) === Number(id)));
  t.mock.method(documentModel, 'touchSessionDocuments', async () => []);
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-2.5-flash' }));
  t.mock.method(aiUsageService, 'assertQuota', onAssertQuota);
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => undefined);
  t.mock.method(aiUsageService, 'getUsage', async () => null);
  t.mock.method(aiProviderService, 'generateAnswer', onGenerate);

  if (vectorThrows) {
    t.mock.method(embeddingService, 'embedQuery', async () => {
      throw new Error('vector unavailable');
    });
  }

  return { addMessages };
}

test('document scope resolver ignores generic tokens and resolves distinctive tokens', () => {
  const generic = chatContext.resolveDocumentScope({
    question: 'Tell me about the assignment',
    documents: docs,
    primaryDocumentId: 101,
  });
  const distinctive = chatContext.resolveDocumentScope({
    question: 'Summarize 530_asm1',
    documents: docs,
    primaryDocumentId: 101,
  });

  assert.equal(generic.type, 'general');
  assert.equal(distinctive.type, 'explicit_single');
  assert.deepEqual(distinctive.documentIds, [103]);
});

test('document scope resolver prefers basename and handles contextual ambiguity', () => {
  const basename = chatContext.resolveDocumentScope({
    question: 'What does Order_305 say about invoices?',
    documents: docs,
    primaryDocumentId: 101,
  });
  const ambiguous = chatContext.resolveDocumentScope({
    question: 'What does this attachment say?',
    documents: docs,
    primaryDocumentId: 101,
  });

  assert.equal(basename.type, 'explicit_single');
  assert.deepEqual(basename.documentIds, [102]);
  assert.equal(ambiguous.type, 'ambiguous');
  assert.deepEqual(ambiguous.matchingDocuments.map((item) => item.id), [102, 103]);
});

test('shared prefix across documents asks for clarification instead of guessing', () => {
  const orderDocs = [
    doc({ id: 201, title: 'Order_January.pdf', origin_session_id: 77 }),
    doc({ id: 202, title: 'Order_February.pdf', origin_session_id: 77 }),
  ];
  const scope = chatContext.resolveDocumentScope({
    question: 'Tell me about file Order',
    documents: orderDocs,
    primaryDocumentId: 201,
  });

  assert.equal(scope.type, 'ambiguous');
  assert.deepEqual(scope.matchingDocuments.map((item) => item.id), [201, 202]);
});

test('explicit Order query returns no Business sources through keyword fallback', async (t) => {
  setupAskMocks(t, {
    chunks: [
      chunk(1, 101, 'Business document mentions invoices and attendance rules.'),
      chunk(2, 102, 'Order 305 PDF contains invoice payment terms and purchase order details.'),
    ],
  });

  const result = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'What does Order_305.pdf say about invoices?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.usedRag, true);
  assert.deepEqual(result.sources.map((source) => source.documentId), [102]);
  assert.deepEqual(result.documents.map((document) => document.id), [102]);
});

test('ambiguous contextual reference does not call provider or quota', async (t) => {
  let providerCalls = 0;
  let quotaCalls = 0;
  const { addMessages } = setupAskMocks(t, {
    chunks: [
      chunk(1, 101, 'Business content'),
      chunk(2, 102, 'Order content'),
      chunk(3, 103, 'Assignment content'),
    ],
    onGenerate: async () => {
      providerCalls += 1;
      return { answer: 'should not happen', usageMetadata: {} };
    },
    onAssertQuota: async () => {
      quotaCalls += 1;
    },
  });

  const result = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'What is this attachment about?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.usedRag, false);
  assert.equal(result.provider, 'system');
  assert.deepEqual(result.sources, []);
  assert.equal(providerCalls, 0);
  assert.equal(quotaCalls, 0);
  assert.deepEqual(result.documents.map((document) => document.id), [102, 103]);
  assert.deepEqual(addMessages.map((message) => message.role), ['user', 'assistant']);
});

test('streaming ambiguity response matches non-streaming system response shape', async (t) => {
  setupAskMocks(t, {
    chunks: [
      chunk(1, 101, 'Business content'),
      chunk(2, 102, 'Order content'),
      chunk(3, 103, 'Assignment content'),
    ],
  });
  const events = [];

  await aiService.askSessionStream({
    sessionId: 77,
    userId: 'student-1',
    question: 'What is this attachment about?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
    sendEvent: (event, data) => events.push({ event, data }),
  });

  const token = events.find((item) => item.event === 'token');
  const done = events.find((item) => item.event === 'done');
  assert.ok(token.data.text);
  assert.equal(done.data.usedRag, false);
  assert.equal(done.data.provider, 'system');
  assert.deepEqual(done.data.sources, []);
  assert.deepEqual(done.data.documents.map((document) => document.id), [102, 103]);
});

test('explicit multi question uses only named files without comparison flow', async (t) => {
  setupAskMocks(t, {
    chunks: [
      chunk(1, 101, 'Business attendance rules and onboarding notes.'),
      chunk(2, 102, 'Order invoice terms.'),
      chunk(3, 103, 'Assignment rubric for attendance rules.'),
    ],
  });

  const result = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'Find attendance rules in Business.docx and 530_asm1.docx',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.comparison, null);
  assert.deepEqual(
    [...new Set(result.sources.map((source) => source.documentId))].sort((a, b) => a - b),
    [101, 103]
  );
});

test('relation wording classifies named documents as comparison scope', () => {
  const university = doc({ id: 301, title: 'TRƯỜNG ĐẠI HỌC KINH TẾ.docx', origin_session_id: 77 });
  const business = doc({ id: 302, title: 'Business.docx', origin_session_id: 77 });
  const analyzed = chatContext.analyzeRequest({
    question: 'file TRƯỜNG ĐẠI HỌC KINH TẾ nói về cái gì, có liên quan gì đến file business không?',
    history: [],
    documents: [university, business],
  });
  const scope = chatContext.resolveDocumentScope({
    question: analyzed.retrievalQuery,
    documents: [university, business],
    primaryDocumentId: 301,
    intent: analyzed.intent,
  });

  assert.equal(analyzed.intent, 'comparison');
  assert.equal(scope.type, 'comparison');
  assert.deepEqual(scope.documentIds, [301, 302]);
});

test('generic two-file reference resolves both active documents before contextual this-file fallback', () => {
  const twoDocs = [
    doc({ id: 401, title: 'Business.docx', cloud_files: { mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }),
    doc({ id: 402, title: 'Plan.docx', cloud_files: { mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }),
  ];
  const analyzed = chatContext.analyzeRequest({
    question: 'tóm tắt 2 file này, nội dung khác nhau chỗ nào, nói ngắn gọn thôi nhé',
    history: [],
    documents: twoDocs,
  });
  const scope = chatContext.resolveDocumentScope({
    question: analyzed.retrievalQuery,
    documents: twoDocs,
    primaryDocumentId: 401,
    intent: analyzed.intent,
  });

  assert.equal(analyzed.intent, 'comparison');
  assert.equal(analyzed.comparisonUnavailable, false);
  assert.equal(scope.type, 'comparison');
  assert.equal(scope.reason, 'generic_two_document_reference');
  assert.deepEqual(scope.documentIds, [401, 402]);
});

test('generic doc attachment wording filters to exactly two DOCX documents', () => {
  const mixedDocs = [
    doc({ id: 411, title: 'Business.docx', cloud_files: { mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }),
    doc({ id: 412, title: 'Order.pdf', cloud_files: { mime_type: 'application/pdf' } }),
    doc({ id: 413, title: 'Plan.docx', cloud_files: { mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }),
  ];
  const analyzed = chatContext.analyzeRequest({
    question: 'ý tôi là 2 file doc trong attachment ấy',
    history: [{
      role: 'user',
      content: 'tóm tắt 2 file này, nội dung khác nhau chỗ nào',
      metadata: { intent: 'comparison', substantiveQuestion: 'tóm tắt 2 file này, nội dung khác nhau chỗ nào' },
    }],
    documents: mixedDocs,
  });
  const scope = chatContext.resolveDocumentScope({
    question: analyzed.retrievalQuery,
    documents: mixedDocs,
    primaryDocumentId: 411,
    intent: analyzed.intent,
  });

  assert.equal(analyzed.intent, 'comparison');
  assert.equal(scope.type, 'comparison');
  assert.equal(scope.reason, 'generic_two_doc_type_reference');
  assert.deepEqual(scope.documentIds, [411, 413]);
  assert.match(analyzed.substantiveQuestion, /tóm tắt 2 file này/iu);
  assert.match(analyzed.substantiveQuestion, /Clarification:/u);
});

test('generic two-file reference with more than two active documents asks for clarification', () => {
  const threeDocs = [
    doc({ id: 421, title: 'Business.docx' }),
    doc({ id: 422, title: 'Order.pdf' }),
    doc({ id: 423, title: 'Plan.txt' }),
  ];
  const analyzed = chatContext.analyzeRequest({
    question: 'compare these two documents',
    history: [],
    documents: threeDocs,
  });
  const scope = chatContext.resolveDocumentScope({
    question: analyzed.retrievalQuery,
    documents: threeDocs,
    primaryDocumentId: 421,
    intent: analyzed.intent,
  });

  assert.equal(analyzed.intent, 'comparison');
  assert.equal(scope.type, 'ambiguous');
  assert.equal(scope.reason, 'ambiguous_generic_two_document_reference');
  assert.deepEqual(scope.matchingDocuments.map((item) => item.id), [421, 422, 423]);
});

test('generic two-file comparison with only one active document remains unavailable', () => {
  const oneDoc = [doc({ id: 431, title: 'Business.docx' })];
  const analyzed = chatContext.analyzeRequest({
    question: 'tóm tắt 2 file này và khác nhau chỗ nào',
    history: [],
    documents: oneDoc,
  });
  const scope = chatContext.resolveDocumentScope({
    question: analyzed.retrievalQuery,
    documents: oneDoc,
    primaryDocumentId: 431,
    intent: analyzed.intent,
  });

  assert.equal(analyzed.intent, 'comparison');
  assert.equal(scope.type, 'comparison');
  assert.equal(scope.reason, 'generic_two_document_unavailable');
  assert.deepEqual(scope.documentIds, [431]);
});

test('explicit multi coverage prevents one document from occupying all final slots', async (t) => {
  const manyBusinessChunks = [
    chunk(11, 101, 'Business attendance rules dashboard workflow alpha.'),
    { ...chunk(12, 101, 'Business attendance rules dashboard workflow beta.'), chunk_index: 1 },
    { ...chunk(13, 101, 'Business attendance rules dashboard workflow gamma.'), chunk_index: 2 },
    chunk(21, 103, 'Assignment attendance rules rubric.'),
  ];
  setupAskMocks(t, { chunks: manyBusinessChunks });

  const result = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'Find attendance rules in Business.docx and 530_asm1.docx',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  const counts = result.sources.reduce((map, source) => {
    map.set(source.documentId, (map.get(source.documentId) || 0) + 1);
    return map;
  }, new Map());
  assert.ok((counts.get(101) || 0) >= 1);
  assert.ok((counts.get(103) || 0) >= 1);
  assert.equal(counts.has(102), false);
});

test('general candidate limit is global across session scope', async (t) => {
  const vectorLimits = [];
  setupAskMocks(t, {
    chunks: [
      chunk(1, 101, 'Business dashboard analytics'),
      chunk(2, 102, 'Order dashboard analytics'),
      chunk(3, 103, 'Assignment dashboard analytics'),
    ],
    vectorThrows: false,
  });
  t.mock.method(embeddingService, 'embedQuery', async () => ({ embedding: [0.1], model: 'test-embedding' }));
  t.mock.method(documentChunkModel, 'matchByEmbeddingAcrossDocuments', async ({ limit }) => {
    vectorLimits.push(limit);
    return [];
  });

  await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'What does the chat say about dashboard analytics?',
    mode: 'hybrid',
    model: 'gemini-2.5-flash',
  });

  assert.deepEqual(vectorLimits, [12]);
});
