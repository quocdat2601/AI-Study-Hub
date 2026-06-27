const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const chatContext = require('../src/services/chat-context.service');
const comparison = require('../src/services/rag-comparison.service');
const aiProvider = require('../src/services/ai-provider.service');
const ragService = require('../src/services/rag.service');

function chunk(id, docId, index, content, metadata = {}, score = 0.7) {
  return {
    id,
    doc_id: docId,
    chunk_index: index,
    content,
    score,
    keywordScore: score,
    vectorScore: score,
    metadata: { documentId: docId, ...metadata },
  };
}

test('prompt follows brevity constraints without mandatory headings', () => {
  const prompts = aiProvider.buildRagPrompts({
    question: 'Noi ngan gon hon',
    documentTitles: ['Firebase proposal', 'Supabase proposal'],
    chunks: [chunk(1, 1, 0, 'Firebase uses MySQL.')],
    mode: 'hybrid',
    history: [{ role: 'user', content: 'Compare the database choices.' }],
    responseConstraints: { brief: true, onlyDifferences: true, pointCount: 3, structure: 'bullets' },
    comparisonMetadata: { strategy: 'requirement_id' },
  });

  assert.doesNotMatch(prompts.systemPrompt, /Always use two sections/i);
  assert.doesNotMatch(prompts.systemPrompt, /Based on the document/i);
  assert.match(prompts.systemPrompt, /Keep the answer brief/i);
  assert.match(prompts.systemPrompt, /no more than 3 points/i);
  assert.match(prompts.userPrompt, /Compare the database choices/i);
});

test('follow-up chain inherits comparison scope and narrows retrieval', () => {
  const documents = [{ id: 1, title: 'Firebase proposal' }, { id: 2, title: 'Supabase proposal' }];
  const initial = chatContext.analyzeRequest({
    question: 'Compare both documents and only state the differences in 3 points',
    history: [],
    documents,
  });
  const focus = chatContext.analyzeRequest({
    question: 'Focus only on the database',
    history: [{
      role: 'assistant',
      content: 'Initial comparison',
      metadata: initial,
    }],
    documents,
  });
  const shorter = chatContext.analyzeRequest({
    question: 'Make it shorter',
    history: [{ role: 'assistant', content: 'Database comparison', metadata: focus }],
    documents,
  });

  assert.equal(focus.intent, 'comparison');
  assert.deepEqual(focus.comparedDocumentIds, [1, 2]);
  assert.equal(focus.retrievalQuery, 'the database');
  assert.deepEqual(focus.history, []);
  assert.equal(shorter.intent, 'comparison');
  assert.equal(shorter.responseConstraints.brief, true);
  assert.equal(shorter.responseConstraints.onlyDifferences, true);
  assert.equal(shorter.responseConstraints.pointCount, 1);
  assert.equal(shorter.responseConstraints.structure, 'paragraph');
  assert.equal(shorter.retrievalQuery, 'the database');
});

test('Vietnamese comparison request captures brevity and point constraints', () => {
  const analyzed = chatContext.analyzeRequest({
    question: 'So sánh hai tài liệu, chỉ nêu điểm khác nhau trong 3 ý, nói ngắn gọn',
    history: [],
    documents: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }],
  });

  assert.equal(analyzed.intent, 'comparison');
  assert.equal(analyzed.responseConstraints.brief, true);
  assert.equal(analyzed.responseConstraints.onlyDifferences, true);
  assert.equal(analyzed.responseConstraints.pointCount, 3);
});

test('comparison aligns nearly identical Firebase and Supabase requirements', () => {
  const firebase = chunk(
    1,
    1,
    2,
    'FR-03 Database and authentication\nUse Firebase Authentication and MySQL for persistent storage.',
    { requirementIds: ['FR-03'], sectionHeading: 'Database and authentication' }
  );
  const supabase = chunk(
    2,
    2,
    2,
    'FR-03 Database and authentication\nUse Supabase Authentication and PostgreSQL for persistent storage.',
    { requirementIds: ['FR-03'], sectionHeading: 'Database and authentication' }
  );
  const groups = comparison.selectProgressiveGroups(
    new Map([[1, [firebase]], [2, [supabase]]]),
    [1, 2],
    'Compare the database and authentication choices'
  );

  assert.equal(groups[0].strategy, 'requirement_id');
  assert.match(groups[0].chunks[0].content, /Firebase.*MySQL/s);
  assert.match(groups[0].chunks[1].content, /Supabase.*PostgreSQL/s);
});

test('SWP and SRS_UPDATE prioritize provider changes over identical overview sections', () => {
  const swpOverview = chunk(1, 1, 0, 'FR-01 Product Perspective\nThe system supports document study workflows.', {
    requirementIds: ['FR-01'], sectionHeading: 'Product Perspective',
  }, 0.2);
  const srsOverview = chunk(2, 2, 0, 'FR-01 Product Perspective\nThe system supports document study workflows.', {
    requirementIds: ['FR-01'], sectionHeading: 'Product Perspective',
  }, 0.2);
  const swpProvider = chunk(3, 1, 4, 'FR-05 Product Constraints\nUse Firebase Storage, MySQL, and deploy on Railway.', {
    requirementIds: ['FR-05'], sectionHeading: 'Product Constraints',
  }, 0.3);
  const srsProvider = chunk(4, 2, 4, 'FR-05 Product Constraints\nUse Supabase Storage, PostgreSQL, and deploy on Supabase.', {
    requirementIds: ['FR-05'], sectionHeading: 'Product Constraints',
  }, 0.3);
  const groups = comparison.selectProgressiveGroups(
    new Map([[1, [swpOverview, swpProvider]], [2, [srsOverview, srsProvider]]]),
    [1, 2],
    'Compare SWP with SRS_UPDATE'
  );

  assert.equal(groups[0].strategy, 'requirement_id');
  assert.equal(groups[0].key, 'FR-05');
  assert.equal(groups[0].providerDifference > 0, true);
  assert.match(groups[0].chunks[0].content, /Firebase Storage.*MySQL.*Railway/s);
  assert.match(groups[0].chunks[1].content, /Supabase Storage.*PostgreSQL.*Supabase/s);
});

test('database follow-up selects relevant evidence from every compared document', () => {
  const query = comparison.expandComparisonQuery('database');
  assert.match(query, /mysql/);
  assert.match(query, /postgresql/);
  assert.match(query, /firebase/);
  assert.match(query, /supabase/);

  const groups = comparison.selectProgressiveGroups(
    new Map([
      [1, [chunk(1, 1, 2, 'FR-05 Database uses Firebase Storage and MySQL on Railway.', {
        requirementIds: ['FR-05'], sectionHeading: 'Product Constraints',
      })]],
      [2, [chunk(2, 2, 2, 'FR-05 Database uses Supabase Storage and PostgreSQL on Supabase.', {
        requirementIds: ['FR-05'], sectionHeading: 'Product Constraints',
      })]],
    ]),
    [1, 2],
    'database'
  );

  assert.equal(groups[0].strategy, 'requirement_id');
  assert.deepEqual(groups[0].chunks.map((item) => item.doc_id), [1, 2]);
});

test('different headings fall back to topic overlap before balanced evidence', () => {
  const firebase = chunk(1, 1, 0, 'Authentication database storage uses Firebase and MySQL.', {
    sectionHeading: 'Infrastructure choices',
  });
  const supabase = chunk(2, 2, 0, 'Authentication database storage uses Supabase and PostgreSQL.', {
    sectionHeading: 'Persistence architecture',
  });
  const groups = comparison.selectProgressiveGroups(
    new Map([[1, [firebase]], [2, [supabase]]]),
    [1, 2],
    'database authentication'
  );

  assert.equal(groups[0].strategy, 'topic_overlap');
});

test('structural inference may use the immediately previous chunk', () => {
  const chunks = comparison.deriveStructureForChunks([
    chunk(1, 1, 0, 'FR-03 Database Architecture', {
      requirementIds: ['FR-03'],
      sectionHeading: 'Database Architecture',
    }),
    chunk(2, 1, 1, 'Use Firebase Authentication and MySQL for storage.'),
    chunk(3, 1, 2, 'The next unrelated section starts here.'),
  ]);
  const current = chunks.find((item) => item.id === 2);

  assert.deepEqual(current.metadata.requirementIds, ['FR-03']);
  assert.equal(current.metadata.sectionHeading, 'Database Architecture');
  assert.equal(current.metadata.structuralNeighborId, 1);
});

test('balanced evidence is tried before insufficient evidence', () => {
  const left = chunk(1, 1, 0, 'Firebase MySQL implementation details', {}, 0.4);
  const right = chunk(2, 2, 0, 'Supabase PostgreSQL architecture', {}, 0.4);
  const balanced = comparison.selectProgressiveGroups(
    new Map([[1, [left]], [2, [right]]]),
    [1, 2],
    'compare database'
  );
  const insufficient = comparison.selectProgressiveGroups(
    new Map([[1, [left]], [2, [{ ...right, keywordScore: 0, vectorScore: 0, score: 0 }]]]),
    [1, 2],
    'compare database'
  );

  assert.equal(balanced[0].strategy, 'balanced');
  assert.deepEqual(insufficient, []);
});

test('removed attachments are deleted from inherited comparison scope', () => {
  const analyzed = chatContext.analyzeRequest({
    question: 'Nói ngắn gọn hơn',
    history: [{
      role: 'assistant',
      content: 'Firebase/MySQL differs from Supabase/PostgreSQL.',
      metadata: {
        intent: 'comparison',
        comparedDocumentIds: [1, 2],
        substantiveQuestion: 'So sánh hai tài liệu',
        retrievalQuery: 'database',
        responseConstraints: { onlyDifferences: true },
      },
    }],
    documents: [{ id: 1, title: 'SWP' }],
  });

  assert.deepEqual(analyzed.activeAttachmentIds, [1]);
  assert.deepEqual(analyzed.inheritedComparedDocumentIds, [1, 2]);
  assert.deepEqual(analyzed.filteredComparedDocumentIds, [1]);
  assert.equal(analyzed.comparisonUnavailable, true);
  assert.deepEqual(analyzed.history, []);
  assert.equal(
    chatContext.buildComparisonUnavailableAnswer('Nói ngắn gọn hơn'),
    'Hiện chỉ còn một tài liệu được đính kèm nên không thể so sánh hai tài liệu.'
  );
});

test('evidence and comparison scope cannot reintroduce a removed document', () => {
  const activeChunk = chunk(1, 1, 0, 'Firebase Storage and MySQL');
  const removedChunk = chunk(2, 2, 0, 'Supabase Storage and PostgreSQL');
  const evidence = comparison.applyContextBudget(
    [{ chunks: [activeChunk] }],
    [activeChunk, removedChunk],
    [1]
  );

  assert.deepEqual(evidence.map((item) => item.doc_id), [1]);
  assert.equal(evidence.some((item) => item.doc_id === 2), false);
});

test('history and evidence budgets remain bounded', () => {
  const history = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    role: index % 2 ? 'assistant' : 'user',
    content: 'x'.repeat(1000),
  }));
  const boundedHistory = chatContext.getRecentConversation(history);
  assert.ok(boundedHistory.length <= 8);
  assert.ok(boundedHistory.reduce((sum, message) => sum + message.content.length, 0) <= 6000);

  const evidence = comparison.applyContextBudget([
    {
      chunks: [
        chunk(1, 1, 0, 'a'.repeat(5000)),
        chunk(2, 2, 0, 'b'.repeat(5000)),
      ],
    },
  ], [], [1, 2]);
  assert.equal(new Set(evidence.map((item) => item.doc_id)).size, 2);
  assert.ok(evidence.reduce((sum, item) => sum + item.promptContent.length, 0) <= 7000);
});

function realisticProviderFixtures() {
  return new Map([
    [1, [
      chunk(101, 1, 10, 'FR-10 Product Perspective\nThe backend persists relational data in MySQL hosted on Railway using Sequelize.', {
        requirementIds: ['FR-10'], sectionHeading: 'Product Perspective', documentTitle: 'SWP',
      }, 0.6),
      chunk(102, 1, 11, 'FR-11 Software Interfaces\nFiles use Firebase Storage SDK with Firebase quota limits.', {
        requirementIds: ['FR-11'], sectionHeading: 'Software Interfaces', documentTitle: 'SWP',
      }, 0.55),
      chunk(103, 1, 20, 'NFR-20 Security\nPrevent SQL injection and XSS through input validation.', {
        requirementIds: ['NFR-20'], sectionHeading: 'Security', documentTitle: 'SWP',
      }, 0.9),
      chunk(104, 1, 21, 'FR-21 Activity Logging\nRecord document and subject filter activity for compliance.', {
        requirementIds: ['FR-21'], sectionHeading: 'Activity Logging', documentTitle: 'SWP',
      }, 0.8),
    ]],
    [2, [
      chunk(201, 2, 10, 'FR-10 Product Perspective\nThe backend persists relational data in PostgreSQL hosted by Supabase using the Supabase SDK.', {
        requirementIds: ['FR-10'], sectionHeading: 'Product Perspective', documentTitle: 'SRS_UPDATE',
      }, 0.6),
      chunk(202, 2, 11, 'FR-11 Software Interfaces\nFiles use Supabase Storage SDK with Supabase quota limits.', {
        requirementIds: ['FR-11'], sectionHeading: 'Software Interfaces', documentTitle: 'SRS_UPDATE',
      }, 0.55),
      chunk(203, 2, 20, 'NFR-20 Security\nPrevent SQL injection and XSS through input validation.', {
        requirementIds: ['NFR-20'], sectionHeading: 'Security', documentTitle: 'SRS_UPDATE',
      }, 0.9),
      chunk(204, 2, 21, 'FR-21 Activity Logging\nRecord document and subject filter activity for compliance.', {
        requirementIds: ['FR-21'], sectionHeading: 'Activity Logging', documentTitle: 'SRS_UPDATE',
      }, 0.8),
    ]],
  ]);
}

test('realistic comparison prioritizes changed providers over shared requirements', () => {
  const documents = [{ id: 1, title: 'SWP' }, { id: 2, title: 'SRS_UPDATE' }];
  const groups = comparison.selectProgressiveGroups(
    realisticProviderFixtures(),
    [1, 2],
    'Compare SWP and SRS_UPDATE and only list technology differences'
  );
  const selectedText = groups.flatMap((group) => group.chunks.map((item) => item.content)).join('\n');

  assert.match(selectedText, /MySQL hosted on Railway/);
  assert.match(selectedText, /PostgreSQL hosted by Supabase/);
  assert.match(selectedText, /Firebase Storage SDK/);
  assert.match(selectedText, /Supabase Storage SDK/);
  assert.doesNotMatch(selectedText, /SQL injection|Activity Logging|compliance/);
  const claims = comparison.buildAllowedDifferenceClaims(groups, documents);
  const answer = comparison.buildGroundedProviderAnswer({ claims });
  assert.equal(
    answer,
    '- Lưu trữ tệp: SWP dùng Firebase Storage; SRS_UPDATE dùng Supabase Storage.\n'
      + '- Cơ sở dữ liệu: SWP dùng MySQL trên Railway; SRS_UPDATE dùng PostgreSQL trên Supabase.'
  );
  assert.doesNotMatch(answer, /Gemini|React|Vite/);
});

test('database follow-up excludes SQL injection, security, and storage-only chunks', () => {
  const groups = comparison.selectProgressiveGroups(
    realisticProviderFixtures(),
    [1, 2],
    'database'
  );
  const selected = groups.flatMap((group) => group.chunks);
  const selectedText = selected.map((item) => item.content).join('\n');

  assert.deepEqual(selected.map((item) => item.id), [101, 201]);
  assert.match(selectedText, /MySQL/);
  assert.match(selectedText, /PostgreSQL/);
  assert.doesNotMatch(selectedText, /SQL injection|XSS|Firebase Storage|Supabase Storage|compliance/);
  assert.equal(selected.every((item) => item.negativeTopicScore === 0), true);
});

test('broad relationship comparison preserves evidence from unrelated documents', async () => {
  const documents = [
    { id: 1, title: 'TRƯỜNG ĐẠI HỌC KINH TẾ.docx' },
    { id: 2, title: 'Business.docx' },
  ];
  const chunks = [
    chunk(1, 1, 0, 'Thorakao global strategy analyzes entering Saudi Arabia with cosmetics distribution.'),
    chunk(2, 2, 0, 'AI Study Hub business logic manages uploaded documents, chat sessions, and study workflows.'),
  ];
  const evidence = await comparison.retrieveComparisonEvidence({
    question: 'file TRƯỜNG ĐẠI HỌC KINH TẾ nói về cái gì, có liên quan gì đến file business không?',
    chunks,
    documents,
  });

  assert.equal(evidence.insufficient, false);
  assert.equal(evidence.metadata.strategy, 'broad_document_coverage');
  assert.deepEqual(evidence.chunks.map((item) => item.doc_id), [1, 2]);
  assert.match(evidence.chunks[0].content, /Thorakao/);
  assert.match(evidence.chunks[1].content, /AI Study Hub/);
});

test('shorter follow-up preserves the immediately previous database scope', () => {
  const documents = [{ id: 1, title: 'SWP' }, { id: 2, title: 'SRS_UPDATE' }];
  const initial = chatContext.analyzeRequest({
    question: 'So sánh SWP và SRS_UPDATE, chỉ nêu điểm khác nhau', history: [], documents,
  });
  const database = chatContext.analyzeRequest({
    question: 'Chỉ tập trung vào database',
    history: [{ role: 'assistant', content: 'Initial result', metadata: initial }],
    documents,
  });
  const shorter = chatContext.analyzeRequest({
    question: 'Nói ngắn gọn hơn',
    history: [{ role: 'assistant', content: 'Database result', metadata: database }],
    documents,
  });
  const groups = comparison.selectProgressiveGroups(
    realisticProviderFixtures(), [1, 2], shorter.retrievalQuery
  );
  const selectedText = groups.flatMap((group) => group.chunks.map((item) => item.content)).join('\n');

  assert.equal(database.retrievalQuery, 'database');
  assert.equal(shorter.retrievalQuery, 'database');
  assert.equal(shorter.responseConstraints.brief, true);
  assert.match(selectedText, /MySQL/);
  assert.match(selectedText, /PostgreSQL/);
  assert.doesNotMatch(selectedText, /SQL injection|Storage SDK|compliance/);
  const claims = comparison.buildAllowedDifferenceClaims(groups, documents);
  assert.equal(
    comparison.buildGroundedProviderAnswer({ claims, databaseOnly: true, compact: true }),
    'SWP dùng MySQL trên Railway; SRS_UPDATE dùng PostgreSQL trên Supabase.'
  );
  assert.equal(shorter.responseConstraints.pointCount, 1);
  assert.equal(shorter.responseConstraints.structure, 'paragraph');
});

test('Firebase Storage is never classified as a database', () => {
  const entities = comparison.extractTechnologyEntities(
    'Files are persisted in Firebase Storage using the Firebase SDK.'
  );
  assert.deepEqual(entities.fileStorage, ['Firebase Storage']);
  assert.deepEqual(entities.database, []);
  assert.deepEqual(entities.hosting, []);
});

test('citation ownership is canonical, immutable, and deduplicated', () => {
  const documents = new Map([
    [1, { id: 1, title: 'SWP' }],
    [2, { id: 2, title: 'SRS_UPDATE' }],
  ]);
  const valid = chunk(101, 1, 10, 'MySQL on Railway', { documentId: 1, documentTitle: 'SWP' });
  const duplicate = { ...valid };
  const mixed = chunk(201, 2, 10, 'PostgreSQL on Supabase', {
    documentId: 2, documentTitle: 'SWP',
  });
  const result = ragService.buildValidatedEvidence([valid, duplicate, mixed], documents);

  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].documentId, result.sources[0].chunkDocumentId);
  assert.equal(result.sources[0].documentTitle, 'SWP');
  assert.equal(Object.isFrozen(result.sources[0]), true);
  assert.equal(result.validation.rejected[0].reason, 'document_title_mismatch');
});

test('Gemini and Qwen share cleaned comparison scope and constraints', () => {
  const options = {
    question: 'Nói ngắn gọn hơn',
    substantiveQuestion: 'So sánh SWP và SRS_UPDATE\nCurrent focus: database',
    retrievalQuery: 'database',
    documentTitles: ['SWP', 'SRS_UPDATE'],
    chunks: [
      chunk(101, 1, 10, 'MySQL on Railway', { documentTitle: 'SWP' }),
      chunk(201, 2, 10, 'PostgreSQL on Supabase', { documentTitle: 'SRS_UPDATE' }),
    ],
    mode: 'document_only',
    history: [],
    responseConstraints: { brief: true, onlyDifferences: true },
    comparisonMetadata: {
      strategy: 'requirement_id',
      structureEquivalent: true,
      allowedDifferenceClaims: [{ category: 'database' }],
      groundedAnswer: 'SWP dùng MySQL trên Railway; SRS_UPDATE dùng PostgreSQL trên Supabase.',
    },
  };
  const sharedPrompt = aiProvider.buildRagPrompts(options);

  assert.match(sharedPrompt.userPrompt, /Current retrieval topic \(do not broaden it\):\ndatabase/);
  assert.match(sharedPrompt.systemPrompt, /Keep the answer brief/);
  assert.doesNotMatch(sharedPrompt.systemPrompt, /Always use two sections/);
  assert.match(sharedPrompt.systemPrompt, /Do not use canned headings/);
  assert.match(sharedPrompt.systemPrompt, /Return exactly this evidence-derived answer/);
  assert.equal(
    aiProvider.sanitizeAnswerCitationAttribution(
      'SWP uses MySQL (chunk 25 của SRS_UPDATE), while SRS_UPDATE uses PostgreSQL [Source 2].'
    ),
    'SWP uses MySQL, while SRS_UPDATE uses PostgreSQL.'
  );
});

test('multi-document prompts forbid unsupported relationship claims', () => {
  const prompts = aiProvider.buildRagPrompts({
    question: 'file A có liên quan gì đến file B không?',
    documentTitles: ['TRƯỜNG ĐẠI HỌC KINH TẾ.docx', 'Business.docx'],
    chunks: [
      chunk(1, 1, 0, 'Thorakao global market strategy in Saudi Arabia.', {
        documentTitle: 'TRƯỜNG ĐẠI HỌC KINH TẾ.docx',
      }),
      chunk(2, 2, 0, 'AI Study Hub business logic and document workflows.', {
        documentTitle: 'Business.docx',
      }),
    ],
    mode: 'hybrid',
    history: [],
    comparisonMetadata: { strategy: 'balanced', comparedDocumentIds: [1, 2] },
  });

  assert.match(prompts.systemPrompt, /Do not claim that documents are related unless/i);
  assert.match(prompts.systemPrompt, /If the documents discuss unrelated subjects/i);
  assert.match(prompts.systemPrompt, /Evaluate each requested document separately/i);
});

// ─── Regression tests for multi-document overview comparison ─────────────────

test('(1) duplicate suffix is stripped so TRƯỜNG ĐẠI HỌC KINH TẾ (1).docx matches query without suffix', () => {
  const documents = [
    { id: 1, title: 'TRƯỜNG ĐẠI HỌC KINH TẾ (1).docx' },
    { id: 2, title: 'Business.docx' },
  ];
  // resolveDocumentScope must resolve both docs when question references each
  // without the "(1)" suffix and without the ".docx" extension.
  const scope = chatContext.resolveDocumentScope({
    question: 'File TRƯỜNG ĐẠI HỌC KINH TẾ và file Business nói về gì',
    documents,
    primaryDocumentId: 1,
    intent: 'comparison',
  });

  assert.deepEqual(
    scope.documentIds.slice().sort((a, b) => a - b),
    [1, 2],
    'both document IDs must resolve'
  );
  assert.notEqual(scope.type, 'ambiguous', 'scope must not be ambiguous');
});

test('analyzeRequest resolves both docs for TRƯỜNG ĐẠI HỌC KINH TẾ (1).docx + Business.docx session', () => {
  const documents = [
    { id: 1, title: 'TRƯỜNG ĐẠI HỌC KINH TẾ (1).docx' },
    { id: 2, title: 'Business.docx' },
  ];
  const context = chatContext.analyzeRequest({
    question: 'File TRƯỜNG ĐẠI HỌC KINH TẾ và file Business nói về gì, chúng có liên quan trực tiếp với nhau không?',
    history: [],
    documents,
  });

  assert.equal(context.intent, 'comparison');
  assert.equal(context.comparisonUnavailable, false,
    'must NOT report comparison unavailable when two docs are attached');
  assert.deepEqual(
    context.comparedDocumentIds.slice().sort((a, b) => a - b),
    [1, 2],
    'both doc IDs must be in comparedDocumentIds'
  );
});

test('partial name "Business" without extension resolves only Business.docx', () => {
  const documents = [
    { id: 10, title: 'SWP.docx' },
    { id: 20, title: 'Business.docx' },
  ];
  const scope = chatContext.resolveDocumentScope({
    question: 'What does Business say about the API?',
    documents,
    primaryDocumentId: 10,
    intent: 'question',
  });

  assert.deepEqual(scope.documentIds, [20]);
  assert.equal(scope.type, 'explicit_single');
});

test('(N) suffix variants (1), (2) are all stripped independently', () => {
  const documents = [
    { id: 1, title: 'Report (1).docx' },
    { id: 2, title: 'Report (2).docx' },
  ];
  const scope1 = chatContext.resolveDocumentScope({
    question: 'Summarize Report',
    documents,
    primaryDocumentId: 1,
    intent: 'question',
  });
  // Both docs have the same de-duplicated basename "report" — must be ambiguous
  // or resolve both (never silently pick just one).
  assert.ok(
    scope1.type === 'ambiguous' || scope1.documentIds.length === 2,
    'multiple docs with same deduplicated basename must be ambiguous or both resolved'
  );

  // Even when user says "Report (1)", the de-duplicated basename "report" still
  // matches both docs. The raw basename "report 1" matches doc 1 only, but
  // because both patterns are in scope, the result is ambiguous rather than
  // silently single-selecting.
  const scope2 = chatContext.resolveDocumentScope({
    question: 'Summarize Report (1)',
    documents,
    primaryDocumentId: 1,
    intent: 'question',
  });
  // At minimum, doc 1 must be in scope; the scope must not be empty.
  assert.ok(scope2.documentIds.includes(1), 'doc 1 must be in scope when query says Report (1)');
});

test('true one-document session still returns comparison-unavailable answer', () => {
  // Use a question that explicitly triggers comparison intent (contains lien quan).
  const q = 'File TRƯỜNG ĐẠI HỌC KINH TẾ và file Business có liên quan gì nhau không?';
  const context = chatContext.analyzeRequest({
    question: q,
    history: [],
    documents: [{ id: 1, title: 'TRƯỜNG ĐẠI HỌC KINH TẾ (1).docx' }],
  });

  assert.equal(context.intent, 'comparison');
  assert.equal(context.comparisonUnavailable, true,
    'only one doc in session → comparison must be unavailable');
  assert.equal(
    chatContext.buildComparisonUnavailableAnswer(q),
    'Hiện chỉ còn một tài liệu được đính kèm nên không thể so sánh hai tài liệu.'
  );
});

test('comparison fallback evidence includes chunks from both documents', async () => {
  const documents = [
    { id: 1, title: 'TRƯỜNG ĐẠI HỌC KINH TẾ (1).docx' },
    { id: 2, title: 'Business.docx' },
  ];
  const chunks = [
    chunk(1, 1, 0, 'Thorakao enters the Saudi Arabia cosmetics market with distribution strategy.'),
    chunk(2, 2, 0, 'AI Study Hub manages uploaded documents and chat sessions for students.'),
  ];
  const evidence = await comparison.retrieveComparisonEvidence({
    question: 'File TRƯỜNG ĐẠI HỌC KINH TẾ và file Business nói về gì, có liên quan không?',
    chunks,
    documents,
  });

  const evidenceDocIds = [...new Set(evidence.chunks.map((c) => c.doc_id))].sort((a, b) => a - b);
  assert.deepEqual(evidenceDocIds, [1, 2],
    'fallback evidence must include chunks from BOTH documents');
  assert.equal(evidence.insufficient, false);
});

test('comparison_all_documents reason still overrides documentScope when no explicit names match', () => {
  const documents = [
    { id: 1, title: 'Tài liệu A' },
    { id: 2, title: 'Tài liệu B' },
  ];
  // Generic comparison question with no explicit document names
  const context = chatContext.analyzeRequest({
    question: 'So sánh hai tài liệu và chỉ nêu điểm khác nhau',
    history: [],
    documents,
  });
  const scope = chatContext.resolveDocumentScope({
    question: context.retrievalQuery,
    documents,
    primaryDocumentId: 1,
    intent: context.intent,
  });

  assert.equal(scope.reason, 'comparison_all_documents');
  assert.deepEqual(
    scope.documentIds.slice().sort((a, b) => a - b),
    [1, 2]
  );
});
