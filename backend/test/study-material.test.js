const assert = require('node:assert/strict');
const test = require('node:test');
const { mock } = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const StudyMaterialService = require('../src/services/study-material.service');
const StudyMaterialModel = require('../src/models/study-material.model');
const DocumentChunkModel = require('../src/models/document-chunk.model');
const documentService = require('../src/services/document.service');
const geminiService = require('../src/services/gemini.service');
const ollamaService = require('../src/services/ollama.service');
const aiUsageService = require('../src/services/ai-usage.service');

mock.method(DocumentChunkModel, 'findByDocumentId', async () => []);

function makeDocumentChunks(text, count = 5) {
  const chunkSize = Math.ceil(text.length / count);
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    doc_id: 1,
    chunk_index: index,
    content: text.slice(index * chunkSize, (index + 1) * chunkSize),
    metadata: { sectionHeading: `Phan ${index + 1}` },
  }));
}

const SAMPLE_DOC_TEXT = 'This is a document with sufficient length about study materials generation. We need enough characters to satisfy the usefulness check.';

function makeFlashcards(count) {
  return Array.from({ length: count }, (_, index) => ({
    front: `Cau hoi ${index + 1}?`,
    back: `Tra loi ${index + 1}.`,
  }));
}

function makeQuizQuestions(count) {
  return Array.from({ length: count }, (_, index) => ({
    question: `Cau hoi ${index + 1}?`,
    options: ['Dap an A', 'Dap an B', 'Dap an C', 'Dap an D'],
    answer: 'Dap an A',
    explanation: `Giai thich ${index + 1}.`,
  }));
}

function mockOllamaUniqueFlashcards(t) {
  let call = 0;
  t.mock.method(ollamaService, 'generateChat', async () => {
    call += 1;
    return {
      text: JSON.stringify({ front: `Cau ${call}?`, back: `Tra loi ${call}.` }),
      usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  });
  return () => call;
}

function mockOllamaUniqueQuiz(t) {
  let call = 0;
  t.mock.method(ollamaService, 'generateChat', async () => {
    call += 1;
    return {
      text: JSON.stringify({
        question: `Cau ${call}?`,
        options: ['Dap an A', 'Dap an B', 'Dap an C', 'Dap an D'],
        answer: 'Dap an A',
        explanation: `Giai thich ${call}.`,
      }),
      usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  });
  return () => call;
}

test('StudyMaterialService generates and saves flashcards successfully', async (t) => {
  const docId = 123;
  const userId = 'user-abc';
  
  // Mock documentService
  t.mock.method(documentService, 'canUseDocumentInChat', async (uid, did) => {
    assert.equal(uid, userId);
    assert.equal(did, docId);
    return {
      id: docId,
      user_id: userId,
      title: 'Testing Document',
      extracted_text: 'This is a document about requirements engineering.',
      extraction_status: 'ready',
    };
  });

  // Mock aiUsageService resolves gemini model
  t.mock.method(aiUsageService, 'resolveModel', (model) => {
    return { provider: 'gemini', model: 'gemini-2.5-flash' };
  });

  // Mock aiUsageService quota check
  t.mock.method(aiUsageService, 'assertQuota', async () => {});
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});

  // Mock geminiService query
  t.mock.method(geminiService, 'queryDocumentChunks', async () => {
    return {
      text: JSON.stringify(makeFlashcards(10)),
      usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  });

  // Mock StudyMaterialModel.create
  t.mock.method(StudyMaterialModel, 'create', async (material) => {
    assert.equal(material.doc_id, docId);
    assert.equal(material.user_id, userId);
    assert.equal(material.material_type, 'flashcard');
    assert.equal(material.title, 'Testing Document Flashcards');
    assert.ok(Array.isArray(material.content));
    return { id: 'material-uuid-123', ...material };
  });

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'flashcard',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.id, 'material-uuid-123');
  assert.equal(result.material_type, 'flashcard');
  assert.equal(result.content.length, 10);
  assert.equal(result.content[0].front, 'Cau hoi 1?');
});

test('StudyMaterialService robustly parses JSON wrapped in conversational text and codeblocks', async (t) => {
  const docId = 456;
  const userId = 'user-xyz';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => {
    return {
      id: docId,
      user_id: userId,
      title: 'Another Doc',
      extracted_text: 'This is a document with sufficient length about study materials generation. We need enough characters to satisfy the usefulness check.',
      extraction_status: 'ready'
    };
  });

  t.mock.method(aiUsageService, 'resolveModel', () => {
    return { provider: 'gemini', model: 'gemini-2.5-flash' };
  });

  t.mock.method(aiUsageService, 'assertQuota', async () => {});
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});

  t.mock.method(geminiService, 'queryDocumentChunks', async () => {
    const cards = makeFlashcards(10);
    cards[0] = { front: 'Cau hoi robust?', back: 'Tra loi robust.' };
    return {
      text: `Sure, here are your flashcards:
\`\`\`json
${JSON.stringify(cards)}
\`\`\`
I hope this helps!`,
      usageMetadata: { promptTokens: 15, completionTokens: 25, totalTokens: 40 },
    };
  });

  t.mock.method(StudyMaterialModel, 'create', async (material) => {
    return { id: 'material-uuid-456', ...material };
  });

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'flashcard',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.id, 'material-uuid-456');
  assert.equal(result.content.length, 10);
  assert.equal(result.content[0].front, 'Cau hoi robust?');
  assert.equal(result.content[0].back, 'Tra loi robust.');
});

test('StudyMaterialService parses JSON with trailing commas from local models', async (t) => {
  const docId = 789;
  const userId = 'user-trailing';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Trailing Comma Doc',
    extracted_text: 'This is a document with sufficient length about study materials generation. We need enough characters to satisfy the usefulness check.',
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }));

  let call = 0;
  t.mock.method(ollamaService, 'generateChat', async ({ format, options }) => {
    call += 1;
    assert.equal(format, 'json');
    assert.equal(options?.num_predict, 512);
    const text = call === 1
      ? '{"front": "Cau 1?", "back": "Tra loi 1.",}'
      : JSON.stringify({ front: `Cau ${call}?`, back: `Tra loi ${call}.` });
    return {
      text,
      usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  });

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-789',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'flashcard',
    model: 'qwen2.5:3b',
  });

  assert.equal(result.content.length, 10);
  assert.equal(result.content[0].front, 'Cau 1?');
});

test('StudyMaterialService unwraps Ollama flashcard object wrappers', async (t) => {
  const docId = 901;
  const userId = 'user-wrap';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Wrapped Doc',
    extracted_text: 'This is a document with sufficient length about study materials generation. We need enough characters to satisfy the usefulness check.',
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }));

  t.mock.method(ollamaService, 'generateChat', async () => ({
    text: JSON.stringify({
      flashcards: makeFlashcards(10).map((card) => ({
        question: card.front,
        answer: card.back,
      })),
    }),
    usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  }));

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-901',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'flashcard',
    model: 'qwen2.5:3b',
  });

  assert.equal(result.content.length, 10);
  assert.equal(result.content[0].front, 'Cau hoi 1?');
  assert.equal(result.content[0].back, 'Tra loi 1.');
});

test('StudyMaterialService resolves letter quiz answers instead of defaulting to option A', async (t) => {
  const docId = 902;
  const userId = 'user-quiz-letter';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Quiz Letter Doc',
    extracted_text: 'This is a document with sufficient length about study materials generation. We need enough characters to satisfy the usefulness check.',
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  }));

  t.mock.method(aiUsageService, 'assertQuota', async () => {});
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});

  t.mock.method(geminiService, 'queryDocumentChunks', async () => ({
    text: JSON.stringify(
      makeQuizQuestions(5).map((item, index) => (
        index === 0
          ? {
            ...item,
            question: 'Thoi ky phat trien?',
            options: ['The ky XV', 'The ky XVIII', 'Cuoi the ky XVIII den nua dau the ky XIX', 'Sau the ky XVIII'],
            answer: 'C',
            explanation: 'Cuoi the ky XVIII den nua dau the ky XIX.',
          }
          : item
      ))
    ),
    usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  }));

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-902',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'quiz',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.content.length, 5);
  assert.equal(result.content[0].answer, 'Cuoi the ky XVIII den nua dau the ky XIX');
});

test('StudyMaterialService accepts quiz items with numeric index answers from Ollama', async (t) => {
  const docId = 904;
  const userId = 'user-quiz-numeric';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Quiz Numeric Doc',
    extracted_text: 'This is a document with sufficient length about study materials generation. We need enough characters to satisfy the usefulness check.',
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }));

  const getCallCount = mockOllamaUniqueQuiz(t);

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-904',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'quiz',
    model: 'qwen2.5:3b',
  });

  assert.ok(getCallCount() >= 5);
  assert.equal(result.content.length, 5);
  assert.equal(result.content[0].answer, 'Dap an A');
});

test('StudyMaterialService parses flashcard JSON arrays with trailing commas', async (t) => {
  const docId = 905;
  const userId = 'user-trailing-array';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Trailing Array Doc',
    extracted_text: 'This is a document with sufficient length about study materials generation. We need enough characters to satisfy the usefulness check.',
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  }));

  t.mock.method(aiUsageService, 'assertQuota', async () => {});
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});

  t.mock.method(geminiService, 'queryDocumentChunks', async () => ({
    text: `${JSON.stringify(makeFlashcards(10)).replace(/\]$/, ',\n]')}`,
    usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  }));

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-905',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'flashcard',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.content.length, 10);
  assert.equal(result.content[9].front, 'Cau hoi 10?');
});

test('StudyMaterialService unwraps Ollama quiz object with question array key', async (t) => {
  const docId = 906;
  const userId = 'user-quiz-question-key';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Quiz Question Key Doc',
    extracted_text: 'This is a document with sufficient length about study materials generation. We need enough characters to satisfy the usefulness check.',
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }));

  mockOllamaUniqueQuiz(t);

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-906',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'quiz',
    model: 'qwen2.5:3b',
  });

  assert.equal(result.content.length, 5);
  assert.equal(result.content[0].answer, 'Dap an A');
  assert.equal(result.content[4].question, 'Cau 5?');
});

test('StudyMaterialService parses single Ollama quiz JSON object', async (t) => {
  const docId = 907;
  const userId = 'user-quiz-single-obj';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Quiz Single Object Doc',
    extracted_text: 'This is a document with sufficient length about study materials generation. We need enough characters to satisfy the usefulness check.',
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }));

  mockOllamaUniqueQuiz(t);

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-907',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'quiz',
    model: 'qwen2.5:3b',
  });

  assert.equal(result.content.length, 5);
  assert.equal(result.content[0].answer, 'Dap an A');
});

test('StudyMaterialService accepts quiz items with A-D fields and prefixed options', async (t) => {
  const docId = 903;
  const userId = 'user-quiz-abcd';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Quiz ABCD Doc',
    extracted_text: 'This is a document with sufficient length about study materials generation. We need enough characters to satisfy the usefulness check.',
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  }));

  t.mock.method(aiUsageService, 'assertQuota', async () => {});
  t.mock.method(aiUsageService, 'logGeminiRequest', async () => {});

  t.mock.method(geminiService, 'queryDocumentChunks', async () => ({
    text: JSON.stringify(
      makeQuizQuestions(5).map((item, index) => (
        index === 0
          ? {
            question: 'Thoi ky nao?',
            A: 'The ky XV',
            B: 'The ky XVIII',
            C: 'Cuoi the ky XVIII den nua dau the ky XIX',
            D: 'Sau the ky XVIII',
            answer: 'C',
            explanation: 'Cuoi the ky XVIII den nua dau the ky XIX la giai doan phat trien chinh.',
          }
          : item
      ))
    ),
    usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  }));

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-903',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'quiz',
    model: 'gemini-2.5-flash',
  });

  assert.equal(result.content.length, 5);
  assert.equal(result.content[0].answer, 'Cuoi the ky XVIII den nua dau the ky XIX');
});

test('StudyMaterialService parses Ollama flashcard Q/A object format', async (t) => {
  const docId = 908;
  const userId = 'user-flashcard-qa';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Flashcard QA Doc',
    extracted_text: SAMPLE_DOC_TEXT,
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }));

  let call = 0;
  t.mock.method(ollamaService, 'generateChat', async () => {
    call += 1;
    return {
      text: JSON.stringify({ Q: `Cau ${call}?`, A: `Tra loi ${call}.` }),
      usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  });

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-908',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'flashcard',
    model: 'qwen2.5:3b',
  });

  assert.equal(result.content.length, 10);
  assert.equal(result.content[0].front, 'Cau 1?');
  assert.equal(result.content[0].back, 'Tra loi 1.');
  assert.equal(result.content[9].front, 'Cau 10?');
});

test('StudyMaterialService accumulates 10 Ollama flashcards across batches', async (t) => {
  const docId = 909;
  const userId = 'user-flashcard-batch';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Flashcard Batch Doc',
    extracted_text: SAMPLE_DOC_TEXT,
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }));

  const getCallCount = mockOllamaUniqueFlashcards(t);

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-909',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'flashcard',
    model: 'qwen2.5:3b',
  });

  assert.equal(getCallCount(), 10);
  assert.equal(result.content.length, 10);
});

test('StudyMaterialService rejects partial Ollama flashcard sets', async (t) => {
  const docId = 910;
  const userId = 'user-flashcard-partial';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Flashcard Partial Doc',
    extracted_text: SAMPLE_DOC_TEXT,
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }));

  t.mock.method(ollamaService, 'generateChat', async () => ({
    text: JSON.stringify({ front: 'Cau lap lai?', back: 'Tra loi lap lai.' }),
    usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  }));

  await assert.rejects(
    () => StudyMaterialService.generateMaterial({
      docId,
      userId,
      materialType: 'flashcard',
      model: 'qwen2.5:3b',
    }),
    (err) => err.publicMessage.includes('10')
  );
});

test('StudyMaterialService repairs Ollama front-only flashcards via back call', async (t) => {
  const docId = 911;
  const userId = 'user-flashcard-front-only';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Front Only Doc',
    extracted_text: SAMPLE_DOC_TEXT,
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }));

  let call = 0;
  t.mock.method(ollamaService, 'generateChat', async ({ systemPrompt }) => {
    call += 1;
    if (String(systemPrompt).includes('{"back"')) {
      const cardNum = Math.ceil(call / 2);
      return {
        text: JSON.stringify({ back: `Tra loi ${cardNum}.` }),
        usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };
    }
    const cardNum = Math.ceil(call / 2);
    return {
      text: JSON.stringify({ front: `Cau ${cardNum}?` }),
      usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  });

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-911',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'flashcard',
    model: 'qwen2.5:3b',
  });

  assert.equal(result.content.length, 10);
  assert.equal(result.content[0].front, 'Cau 1?');
  assert.equal(result.content[0].back, 'Tra loi 1.');
  assert.ok(call >= 20);
});

test('StudyMaterialService rotates document chunks across Ollama quiz batches', async (t) => {
  const docId = 912;
  const userId = 'user-quiz-chunks';
  const longText = `${SAMPLE_DOC_TEXT} ${'Noi dung bo sung ve kinh te. '.repeat(120)}`.trim();

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Chunk Quiz Doc',
    extracted_text: longText,
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }));

  const chunks = makeDocumentChunks(longText, 8);
  t.mock.method(DocumentChunkModel, 'findByDocumentId', async () => chunks);

  const getCallCount = mockOllamaUniqueQuiz(t);

  t.mock.method(StudyMaterialModel, 'create', async (material) => ({
    id: 'material-uuid-912',
    ...material,
  }));

  const result = await StudyMaterialService.generateMaterial({
    docId,
    userId,
    materialType: 'quiz',
    model: 'qwen2.5:3b',
  });

  assert.equal(result.content.length, 5);
  assert.ok(getCallCount() >= 5);
});

test('StudyMaterialService rejects quiz items with placeholder options', async (t) => {
  const docId = 913;
  const userId = 'user-quiz-placeholder';

  t.mock.method(documentService, 'canUseDocumentInChat', async () => ({
    id: docId,
    user_id: userId,
    title: 'Quiz Placeholder Doc',
    extracted_text: SAMPLE_DOC_TEXT,
    extraction_status: 'ready',
  }));

  t.mock.method(aiUsageService, 'resolveModel', () => ({
    provider: 'ollama',
    model: 'qwen2.5:3b',
  }));

  t.mock.method(ollamaService, 'generateChat', async () => ({
    text: JSON.stringify({
      question: 'Cau hoi that?',
      options: ['Sai 1', 'Sai 2', 'Sai 3', 'Dap an dung'],
      answer: 'Dap an dung',
      explanation: 'Vi du.',
    }),
    usageMetadata: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  }));

  await assert.rejects(
    () => StudyMaterialService.generateMaterial({
      docId,
      userId,
      materialType: 'quiz',
      model: 'qwen2.5:3b',
    }),
    (err) => /5|trắc nghiệm|valid quiz/i.test(String(err.publicMessage || err.message || ''))
  );
});
