const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const aiProvider = require('../src/services/ai-provider.service');
const aiService = require('../src/services/ai.service');

test('RAG inline citations metadata integration', async (t) => {
  await t.test('ai-provider system prompt constraints have citation instructions', () => {
    const { systemPrompt } = aiProvider.buildRagPrompts({
      question: 'Test question',
      documentTitle: 'Test Doc',
      chunks: [],
      mode: 'hybrid',
      provider: 'gemini'
    });
    
    assert.match(systemPrompt, /\[\d+\]/i, 'Prompt should request brackets around citation numbers');
    assert.match(systemPrompt, /inline/i, 'Prompt should request inline citations');
  });

  await t.test('buildScopeResponse / database metadata structure matches spec', () => {
    const sources = [
      { id: 101, chunkId: 101, chunkIndex: 0, documentId: 44, documentTitle: 'Doc A' },
      { id: 102, chunkId: 102, chunkIndex: 1, documentId: 44, documentTitle: 'Doc A' }
    ];

    const citationMap = aiService.buildCitationMap(sources);

    assert.ok(Array.isArray(citationMap), 'citationMap should be an array');
    assert.equal(citationMap.length, 2, 'citationMap should have exactly 2 entries');
    assert.deepEqual(citationMap[0], {
      citationNumber: 1,
      chunkId: 101,
      documentId: 44
    });
    assert.deepEqual(citationMap[1], {
      citationNumber: 2,
      chunkId: 102,
      documentId: 44
    });
  });
});
