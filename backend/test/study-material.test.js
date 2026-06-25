const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const StudyMaterialService = require('../src/services/study-material.service');
const StudyMaterialModel = require('../src/models/study-material.model');
const documentService = require('../src/services/document.service');
const geminiService = require('../src/services/gemini.service');
const ollamaService = require('../src/services/ollama.service');
const aiUsageService = require('../src/services/ai-usage.service');

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
      text: JSON.stringify([
        { front: 'Flashcard 1 Q', back: 'Flashcard 1 A' },
        { front: 'Flashcard 2 Q', back: 'Flashcard 2 A' },
      ]),
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
  assert.equal(result.content.length, 2);
  assert.equal(result.content[0].front, 'Flashcard 1 Q');
});
