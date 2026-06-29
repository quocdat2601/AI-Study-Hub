const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const aiService = require('../src/services/ai.service');
const chatContext = require('../src/services/chat-context.service');
const chatModel = require('../src/models/chat.model');
const documentModel = require('../src/models/document.model');
const documentChunkModel = require('../src/models/document-chunk.model');
const documentService = require('../src/services/document.service');
const embeddingService = require('../src/services/embedding.service');
const aiProviderService = require('../src/services/ai-provider.service');
const ollamaService = require('../src/services/ollama.service');
const aiUsageService = require('../src/services/ai-usage.service');
const chatService = require('../src/services/chat.service');
const documentTextService = require('../src/services/document-text.service');

function doc(overrides) {
  return {
    user_id: 'student-1',
    document_scope: 'session',
    lifecycle_status: 'active',
    status: 'indexed',
    extraction_status: 'ready',
    extracted_text: 'Test content.',
    deleted_at: null,
    cloud_files: { mime_type: 'application/pdf', storage_path: 'user-1/test.pdf' },
    ...overrides,
  };
}

test('chat-context.service exports resolveDocumentScope', () => {
  assert.equal(typeof chatContext.resolveDocumentScope, 'function', 'resolveDocumentScope should be exported');
});

test('image question classifier prioritizes OCR text questions over visual image questions', () => {
  assert.equal(
    chatContext.classifyImageQuestion('hình ảnh tôi vừa gửi viết gì ở trên đó?'),
    'image_text_transcription'
  );
  assert.equal(chatContext.classifyImageQuestion('ảnh có chữ gì?'), 'image_text_transcription');
  assert.equal(chatContext.classifyImageQuestion('đọc chữ trong ảnh'), 'image_text_transcription');
  assert.equal(chatContext.classifyImageQuestion('nội dung chữ trong screenshot'), 'image_text_transcription');
  assert.equal(chatContext.classifyImageQuestion('what does the image say?'), 'image_text_transcription');
  assert.equal(chatContext.classifyImageQuestion('read the text in the image'), 'image_text_transcription');
  assert.equal(chatContext.classifyImageQuestion('tra loi cau hoi trong anh moi nhat toi gui'), 'image_question_answering');
  assert.equal(chatContext.classifyImageQuestion('trong ảnh có vật gì?'), 'image_visual_question');
  assert.equal(chatContext.classifyImageQuestion('mô tả bức ảnh'), 'image_visual_question');
  assert.equal(chatContext.classifyImageQuestion('biểu đồ này thể hiện gì?'), 'image_visual_question');
  assert.equal(chatContext.classifyImageQuestion('what objects are in the image?'), 'image_visual_question');
});

test('askSession with focusedDocumentId still processing handles needsProcessing correctly', async (t) => {
  const docs = [
    doc({ id: 1, title: 'Primary.docx', origin_session_id: 77 }),
    doc({ id: 2, title: 'pasted-image.png', origin_session_id: 77, extraction_status: 'processing', extracted_text: null }),
  ];

  t.mock.method(chatModel, 'findOwnedSession', async () => ({ id: 77, user_id: 'student-1' }));
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => [{ doc_id: 1 }, { doc_id: 2 }]);
  t.mock.method(documentModel, 'findActiveById', async (id) => docs.find(d => d.id === id));
  t.mock.method(documentService, 'canAttachDocumentToSession', async () => true);
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async () => ({ id: 99 }));
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => []);
  t.mock.method(embeddingService, 'embedQuery', async () => ({ embedding: [], model: 'mock' }));
  t.mock.method(aiProviderService, 'generateAnswer', async () => ({ answer: 'Mock Answer' }));
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});
  t.mock.method(aiUsageService, 'getUsage', async () => ({}));
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-1.5-flash' }));
  t.mock.method(documentTextService, 'isExtractedTextUseful', (text) => !!text);

  const res = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'What is this image?',
    focusedDocumentId: 2,
    mode: 'hybrid',
    model: 'gemini-1.5-flash',
  });

  assert.equal(res.needsProcessing, true);
  assert.equal(res.processingError, 'Document is still processing');
});

test('askSession with primary DOCX and pasted OCR image focused retrieves correctly', async (t) => {
  const docs = [
    doc({ id: 1, title: 'Primary.docx', origin_session_id: 77 }),
    doc({ id: 2, title: 'pasted-image.png', origin_session_id: 77, extraction_status: 'ready', extracted_text: 'Image text' }),
  ];

  t.mock.method(chatModel, 'findOwnedSession', async () => ({ id: 77, user_id: 'student-1', primary_document_id: 1 }));
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => [{ doc_id: 1 }, { doc_id: 2 }]);
  t.mock.method(chatModel, 'touchSession', async () => true);
  t.mock.method(documentModel, 'findActiveById', async (id) => docs.find(d => d.id === id));
  t.mock.method(documentModel, 'touchSessionDocuments', async () => true);
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async () => ({ id: 99 }));
  
  const mockChunks = [
    { id: 'c0', doc_id: 1, content: 'Doc text', metadata: { documentId: 1 } },
    { id: 'c1', doc_id: 2, content: 'Image text match', metadata: { documentId: 2 } }
  ];
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => mockChunks);
  t.mock.method(documentChunkModel, 'findByDocumentId', async (id) => mockChunks.filter(c => Number(c.doc_id) === Number(id)));
  
  t.mock.method(documentChunkModel, 'matchByEmbeddingAcrossDocuments', async () => [
    { id: 'c1', doc_id: 2, content: 'Image text match', metadata: { documentId: 2 }, score: 0.9 }
  ]);
  t.mock.method(documentChunkModel, 'matchByEmbedding', async () => [
    { id: 'c1', doc_id: 2, content: 'Image text match', metadata: { documentId: 2 }, score: 0.9 }
  ]);
  t.mock.method(embeddingService, 'embedQuery', async () => ({ embedding: [], model: 'mock' }));
  t.mock.method(aiProviderService, 'generateAnswer', async (args) => {
    assert.ok(args.chunks.some(c => Number(c.doc_id) === 2), 'Should include chunks from document 2');
    return { answer: 'Mock Image Answer' };
  });
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});
  t.mock.method(aiUsageService, 'getUsage', async () => ({}));
  t.mock.method(aiUsageService, 'assertQuota', async () => {});
  t.mock.method(aiProviderService, 'sanitizeAnswerCitationAttribution', (ans) => ans);
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-1.5-flash' }));
  t.mock.method(documentTextService, 'isExtractedTextUseful', (text) => !!text);

  const res = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'What is this image?',
    focusedDocumentId: 2,
    mode: 'hybrid',
    model: 'gemini-1.5-flash',
  });

  assert.equal(res.needsProcessing, false, 'Should not need processing');
  assert.equal(res.answer, 'Mock Image Answer');
});

test('askSession image text question uses OCR chunks instead of visual limitation', async (t) => {
  const docs = [
    doc({ id: 1, title: 'Business.docx', origin_session_id: 77 }),
    doc({
      id: 2,
      title: 'pasted-image.png',
      origin_session_id: 77,
      extraction_status: 'ready',
      extracted_text: 'Tong tien thanh toan la 250000 VND',
      cloud_files: { mime_type: 'image/png', storage_path: 'user-1/pasted-image.png' },
    }),
  ];

  t.mock.method(chatModel, 'findOwnedSession', async () => ({ id: 77, user_id: 'student-1', primary_document_id: 1 }));
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => [{ doc_id: 1 }, { doc_id: 2 }]);
  t.mock.method(chatModel, 'touchSession', async () => true);
  t.mock.method(documentModel, 'findActiveById', async (id) => docs.find(d => Number(d.id) === Number(id)));
  t.mock.method(documentModel, 'touchSessionDocuments', async () => true);
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async () => ({ id: 99 }));
  t.mock.method(documentTextService, 'isExtractedTextUseful', (text) => !!text);

  const mockChunks = [
    { id: 'business', doc_id: 1, content: 'Business workflow text', metadata: { documentId: 1 } },
    { id: 'image-ocr', doc_id: 2, content: 'Tong tien thanh toan la 250000 VND', metadata: { documentId: 2 } },
  ];
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => mockChunks);
  t.mock.method(documentChunkModel, 'findByDocumentId', async (id) => mockChunks.filter(c => Number(c.doc_id) === Number(id)));
  t.mock.method(documentChunkModel, 'matchByEmbeddingAcrossDocuments', async (_docIds) => [
    { id: 'image-ocr', doc_id: 2, content: 'Tong tien thanh toan la 250000 VND', metadata: { documentId: 2 }, score: 0.92 },
  ]);
  t.mock.method(documentChunkModel, 'matchByEmbedding', async () => [
    { id: 'image-ocr', doc_id: 2, content: 'Tong tien thanh toan la 250000 VND', metadata: { documentId: 2 }, score: 0.92 },
  ]);
  t.mock.method(embeddingService, 'embedQuery', async () => ({ embedding: [], model: 'mock' }));
  t.mock.method(aiProviderService, 'generateAnswer', async (args) => {
    assert.equal(args.imageQuestionType, 'image_text_transcription');
    assert.ok(args.chunks.length > 0, 'OCR chunks should be sent to provider');
    assert.ok(args.chunks.every(c => Number(c.doc_id) === 2), 'Only image chunks should be used');
    return { answer: 'Tren hinh co ghi: Tong tien thanh toan la 250000 VND.' };
  });
  t.mock.method(aiProviderService, 'sanitizeAnswerCitationAttribution', (ans) => ans);
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});
  t.mock.method(aiUsageService, 'getUsage', async () => ({}));
  t.mock.method(aiUsageService, 'assertQuota', async () => {});
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-1.5-flash' }));

  const res = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'hinh anh toi vua gui viet gi o tren do?',
    mode: 'hybrid',
    model: 'gemini-1.5-flash',
  });

  assert.equal(res.answer, 'Tren hinh co ghi: Tong tien thanh toan la 250000 VND.');
  assert.equal(res.usedRag, true);
  assert.deepEqual([...new Set(res.sources.map((source) => Number(source.documentId)))], [2]);
});

test('askSession Vietnamese image text question sends OCR-labeled prompt to Ollama', async (t) => {
  const docs = [
    doc({ id: 1, title: 'Business.docx', origin_session_id: 77 }),
    doc({
      id: 2,
      title: 'pasted-image.png',
      origin_session_id: 77,
      extraction_status: 'ready',
      extracted_text: 'Tong tien thanh toan la 250000 VND',
      cloud_files: { mime_type: 'image/png', storage_path: 'user-1/pasted-image.png' },
    }),
  ];

  t.mock.method(chatModel, 'findOwnedSession', async () => ({ id: 77, user_id: 'student-1', primary_document_id: 1 }));
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => [{ doc_id: 1 }, { doc_id: 2 }]);
  t.mock.method(chatModel, 'touchSession', async () => true);
  t.mock.method(documentModel, 'findActiveById', async (id) => docs.find(d => Number(d.id) === Number(id)));
  t.mock.method(documentModel, 'touchSessionDocuments', async () => true);
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async () => ({ id: 99 }));
  t.mock.method(documentTextService, 'isExtractedTextUseful', (text) => !!text);

  const mockChunks = [
    { id: 'business', doc_id: 1, content: 'Business workflow text', metadata: { documentId: 1 } },
    { id: 'image-ocr', doc_id: 2, content: 'Tong tien thanh toan la 250000 VND', metadata: { documentId: 2 } },
  ];
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => mockChunks);
  t.mock.method(documentChunkModel, 'findByDocumentId', async (id) => mockChunks.filter(c => Number(c.doc_id) === Number(id)));
  t.mock.method(documentChunkModel, 'matchByEmbeddingAcrossDocuments', async () => [
    { id: 'image-ocr', doc_id: 2, content: 'Tong tien thanh toan la 250000 VND', metadata: { documentId: 2 }, score: 0.92 },
  ]);
  t.mock.method(documentChunkModel, 'matchByEmbedding', async () => [
    { id: 'image-ocr', doc_id: 2, content: 'Tong tien thanh toan la 250000 VND', metadata: { documentId: 2 }, score: 0.92 },
  ]);
  t.mock.method(embeddingService, 'embedQuery', async () => ({ embedding: [], model: 'mock' }));
  t.mock.method(ollamaService, 'generateChat', async ({ model, systemPrompt, userPrompt }) => {
    assert.equal(model, 'qwen2.5:3b');
    assert.match(systemPrompt, /OCR-extracted text from the user's attached image/);
    assert.match(systemPrompt, /Do not claim that you cannot inspect the image/);
    assert.match(userPrompt, /Retrieved OCR text chunks/);
    assert.match(userPrompt, /Tong tien thanh toan la 250000 VND/);
    return {
      text: 'Trong hình có ghi: Tong tien thanh toan la 250000 VND.',
      model,
      usageMetadata: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
    };
  });
  t.mock.method(aiProviderService, 'sanitizeAnswerCitationAttribution', (ans) => ans);
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});
  t.mock.method(aiUsageService, 'getUsage', async () => ({}));
  t.mock.method(aiUsageService, 'assertQuota', async () => {});
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'ollama', model: 'qwen2.5:3b' }));

  const res = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'hình ảnh tôi vừa gửi viết gì ở trên đó?',
    mode: 'hybrid',
    model: 'qwen2.5:3b',
  });

  assert.equal(res.answer, 'Trong hình có ghi: Tong tien thanh toan la 250000 VND.');
  assert.equal(res.provider, 'ollama');
  assert.equal(res.usedRag, true);
  assert.doesNotMatch(res.answer, /chưa đọc được nội dung chữ|cannot analyze/i);
  assert.deepEqual([...new Set(res.sources.map((source) => Number(source.documentId)))], [2]);
});

test('askSession visual image question returns limitation without searching unrelated documents', async (t) => {
  const docs = [
    doc({ id: 1, title: 'Business.docx', origin_session_id: 77 }),
    doc({
      id: 2,
      title: 'pasted-image.png',
      origin_session_id: 77,
      extraction_status: 'ready',
      extracted_text: 'Tong tien thanh toan la 250000 VND',
      cloud_files: { mime_type: 'image/png', storage_path: 'user-1/pasted-image.png' },
    }),
  ];

  t.mock.method(chatModel, 'findOwnedSession', async () => ({ id: 77, user_id: 'student-1', primary_document_id: 1 }));
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => [{ doc_id: 1 }, { doc_id: 2 }]);
  t.mock.method(chatModel, 'touchSession', async () => true);
  t.mock.method(documentModel, 'findActiveById', async (id) => docs.find(d => Number(d.id) === Number(id)));
  t.mock.method(documentModel, 'touchSessionDocuments', async () => true);
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async (_sessionId, role, content) => ({ id: role === 'assistant' ? 100 : 99, content }));
  t.mock.method(documentTextService, 'isExtractedTextUseful', (text) => !!text);
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => {
    throw new Error('retrieval should not run for visual-only image questions');
  });
  t.mock.method(aiProviderService, 'generateAnswer', async () => {
    throw new Error('provider should not be called for visual-only image questions');
  });
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-1.5-flash' }));

  const res = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'trong anh co vat gi?',
    mode: 'hybrid',
    model: 'gemini-1.5-flash',
  });

  assert.equal(res.usedRag, false);
  assert.equal(res.provider, 'system');
  assert.equal(res.sources.length, 0);
  assert.match(res.answer, /OCR|hinh anh|visual/i);
});

test('askSession no-text targeted image returns OCR limitation', async (t) => {
  const docs = [
    doc({ id: 1, title: 'Business.docx', origin_session_id: 77 }),
    doc({
      id: 2,
      title: 'pasted-image.png',
      origin_session_id: 77,
      extraction_status: 'failed',
      extraction_error: 'No readable text could be extracted',
      extracted_text: '',
      cloud_files: { mime_type: 'image/png', storage_path: 'user-1/pasted-image.png' },
    }),
  ];

  t.mock.method(chatModel, 'findOwnedSession', async () => ({ id: 77, user_id: 'student-1', primary_document_id: 1 }));
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => [{ doc_id: 1 }, { doc_id: 2 }]);
  t.mock.method(chatModel, 'touchSession', async () => true);
  t.mock.method(documentModel, 'findActiveById', async (id) => docs.find(d => Number(d.id) === Number(id)));
  t.mock.method(documentModel, 'touchSessionDocuments', async () => true);
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async () => ({ id: 99 }));
  t.mock.method(documentTextService, 'isExtractedTextUseful', (text) => Boolean(text));
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-1.5-flash' }));

  const res = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'hinh anh toi vua gui viet gi?',
    mode: 'hybrid',
    model: 'gemini-1.5-flash',
  });

  assert.equal(res.usedRag, false);
  assert.equal(res.provider, 'system');
  assert.equal(res.sources.length, 0);
  assert.equal(res.processingError, 'No readable text could be extracted');
});

test('askDocumentStream does not throw undefined reference', async (t) => {
  const docs = [
    doc({ id: 1, title: 'Primary.docx', origin_session_id: 77 }),
  ];

  t.mock.method(documentModel, 'findById', async (id) => docs.find(d => d.id === id));
  t.mock.method(documentModel, 'findActiveById', async (id) => docs.find(d => d.id === id));
  t.mock.method(documentModel, 'touchSessionDocuments', async () => true);
  t.mock.method(documentTextService, 'isExtractedTextUseful', (text) => !!text);
  t.mock.method(chatService, 'getOrCreateSession', async () => ({ id: 77, user_id: 'student-1' }));
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async () => ({ id: 99 }));
  t.mock.method(chatModel, 'touchSession', async () => true);
  
  const mockChunks = [
    { id: 'c1', doc_id: 1, content: 'test', metadata: {} }
  ];
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => mockChunks);
  t.mock.method(documentChunkModel, 'findByDocumentId', async (id) => mockChunks.filter(c => Number(c.doc_id) === Number(id)));
  
  t.mock.method(documentChunkModel, 'matchByEmbedding', async () => []);
  t.mock.method(embeddingService, 'embedQuery', async () => ({ embedding: [], model: 'mock' }));
  t.mock.method(aiProviderService, 'generateAnswer', async () => ({ answer: 'Streamed Answer' }));
  
  async function* mockStream() {
    yield { type: 'token', text: 'Streamed ' };
    yield { type: 'token', text: 'Answer' };
  }
  t.mock.method(aiProviderService, 'streamAnswer', mockStream);
  
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});
  t.mock.method(aiUsageService, 'getUsage', async () => ({}));
  t.mock.method(aiUsageService, 'assertQuota', async () => {});
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-1.5-flash' }));

  let streamedTokens = [];
  const sendEvent = (event, data) => {
    if (event === 'token') streamedTokens.push(data.text);
  };

  await aiService.askDocumentStream({
    id: 1,
    userId: 'student-1',
    question: 'Hello',
    mode: 'hybrid',
    model: 'gemini-1.5-flash',
    sendEvent,
  });

  assert.ok(true, 'Stream request completed without error');
});

test('latest image question resolves newest image and answers OCR multiple choice', async (t) => {
  const docs = [
    doc({ id: 1, title: 'Primary.docx', origin_session_id: 77, created_at: '2026-01-01T00:00:00Z' }),
    doc({
      id: 2,
      title: 'pasted-older-100111.png',
      origin_session_id: 77,
      created_at: '2026-01-02T00:00:00Z',
      extracted_text: 'Older image text',
      cloud_files: { mime_type: 'image/png', storage_path: 'user-1/pasted-older-100111.png' },
    }),
    doc({
      id: 3,
      title: 'pasted-newest-205712.png',
      origin_session_id: 77,
      created_at: '2026-01-03T00:00:00Z',
      extracted_text: 'Question: What is 2 + 2? A. 3 B. 4 C. 5 D. 6',
      cloud_files: { mime_type: 'image/png', storage_path: 'user-1/pasted-newest-205712.png' },
    }),
  ];

  t.mock.method(chatModel, 'findOwnedSession', async () => ({ id: 77, user_id: 'student-1', primary_document_id: 1 }));
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => docs.map((item) => ({ doc_id: item.id })));
  t.mock.method(chatModel, 'touchSession', async () => true);
  t.mock.method(documentModel, 'findActiveById', async (id) => docs.find((item) => Number(item.id) === Number(id)));
  t.mock.method(documentModel, 'touchSessionDocuments', async () => true);
  t.mock.method(chatModel, 'getRecentMessages', async () => []);
  t.mock.method(chatModel, 'addMessage', async (_sessionId, role, content, metadata = {}) => ({ id: role === 'user' ? 100 : 101, role, content, metadata }));
  t.mock.method(documentTextService, 'isExtractedTextUseful', (text) => !!text);

  const chunks = [
    { id: 'older', doc_id: 2, content: 'Older image text', metadata: { documentId: 2 } },
    { id: 'newest', doc_id: 3, content: 'Question: What is 2 + 2? A. 3 B. 4 C. 5 D. 6', metadata: { documentId: 3 } },
  ];
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => chunks);
  t.mock.method(documentChunkModel, 'findByDocumentId', async (id) => chunks.filter((chunk) => Number(chunk.doc_id) === Number(id)));
  t.mock.method(documentChunkModel, 'matchByEmbedding', async () => [
    { id: 'newest', doc_id: 3, content: 'Question: What is 2 + 2? A. 3 B. 4 C. 5 D. 6', metadata: { documentId: 3 }, score: 0.94 },
  ]);
  t.mock.method(documentChunkModel, 'matchByEmbeddingAcrossDocuments', async () => [
    { id: 'newest', doc_id: 3, content: 'Question: What is 2 + 2? A. 3 B. 4 C. 5 D. 6', metadata: { documentId: 3 }, score: 0.94 },
  ]);
  t.mock.method(embeddingService, 'embedQuery', async () => ({ embedding: [], model: 'mock' }));
  t.mock.method(aiProviderService, 'generateAnswer', async (args) => {
    assert.equal(args.imageQuestionType, 'image_multiple_choice_question');
    assert.match(args.question, /tra loi cau hoi/i);
    assert.ok(args.chunks.every((chunk) => Number(chunk.doc_id) === 3));
    return { answer: 'Question: What is 2 + 2? Selected option: B. 4. Explanation: 2 + 2 equals 4.' };
  });
  t.mock.method(aiProviderService, 'sanitizeAnswerCitationAttribution', (answer) => answer);
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-1.5-flash' }));
  t.mock.method(aiUsageService, 'assertQuota', async () => {});
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});
  t.mock.method(aiUsageService, 'getUsage', async () => ({}));

  const result = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: 'tra loi cau hoi trong anh moi nhat toi gui',
    mode: 'hybrid',
    model: 'gemini-1.5-flash',
  });

  assert.equal(result.answer.includes('B. 4'), true);
  assert.deepEqual([...new Set(result.sources.map((source) => Number(source.documentId)))], [3]);
});

test('filename suffix clarification inherits previous image question task', async (t) => {
  const docs = [
    doc({ id: 1, title: 'Primary.docx', origin_session_id: 77 }),
    doc({
      id: 3,
      title: 'pasted-newest-205712.png',
      origin_session_id: 77,
      extracted_text: 'Question: Which option is correct? A. Alpha B. Beta C. Gamma D. Delta',
      cloud_files: { mime_type: 'image/png', storage_path: 'user-1/pasted-newest-205712.png' },
    }),
  ];

  t.mock.method(chatModel, 'findOwnedSession', async () => ({ id: 77, user_id: 'student-1', primary_document_id: 1 }));
  t.mock.method(chatModel, 'listActiveSessionDocumentLinks', async () => docs.map((item) => ({ doc_id: item.id })));
  t.mock.method(chatModel, 'touchSession', async () => true);
  t.mock.method(documentModel, 'findActiveById', async (id) => docs.find((item) => Number(item.id) === Number(id)));
  t.mock.method(documentModel, 'touchSessionDocuments', async () => true);
  t.mock.method(chatModel, 'getRecentMessages', async () => [
    {
      id: 10,
      role: 'user',
      content: 'tra loi cau hoi trong anh moi nhat toi gui',
      metadata: {
        imageQuestionType: 'image_question_answering',
        substantiveQuestion: 'tra loi cau hoi trong anh moi nhat toi gui',
        retrievalQuery: 'tra loi cau hoi trong anh moi nhat toi gui',
      },
    },
  ]);
  t.mock.method(chatModel, 'addMessage', async (_sessionId, role, content, metadata = {}) => ({ id: role === 'user' ? 100 : 101, role, content, metadata }));
  t.mock.method(documentTextService, 'isExtractedTextUseful', (text) => !!text);

  const chunks = [
    { id: 'newest', doc_id: 3, content: 'Question: Which option is correct? A. Alpha B. Beta C. Gamma D. Delta', metadata: { documentId: 3 } },
  ];
  t.mock.method(documentChunkModel, 'findByDocumentIds', async () => chunks);
  t.mock.method(documentChunkModel, 'findByDocumentId', async (id) => chunks.filter((chunk) => Number(chunk.doc_id) === Number(id)));
  t.mock.method(documentChunkModel, 'matchByEmbedding', async () => chunks);
  t.mock.method(documentChunkModel, 'matchByEmbeddingAcrossDocuments', async () => chunks);
  t.mock.method(embeddingService, 'embedQuery', async () => ({ embedding: [], model: 'mock' }));
  t.mock.method(aiProviderService, 'generateAnswer', async (args) => {
    assert.equal(args.imageQuestionType, 'image_multiple_choice_question');
    assert.match(args.question, /Clarification: 205712/);
    assert.doesNotMatch(args.question, /^205712$/);
    return { answer: 'Selected option: B. Beta. Short explanation.' };
  });
  t.mock.method(aiProviderService, 'sanitizeAnswerCitationAttribution', (answer) => answer);
  t.mock.method(aiUsageService, 'resolveModel', () => ({ provider: 'gemini', model: 'gemini-1.5-flash' }));
  t.mock.method(aiUsageService, 'assertQuota', async () => {});
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});
  t.mock.method(aiUsageService, 'getUsage', async () => ({}));

  const result = await aiService.askSession({
    sessionId: 77,
    userId: 'student-1',
    question: '205712',
    mode: 'hybrid',
    model: 'gemini-1.5-flash',
  });

  assert.equal(result.answer.includes('Beta'), true);
  assert.deepEqual([...new Set(result.sources.map((source) => Number(source.documentId)))], [3]);
});


