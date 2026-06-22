const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

async function importFrontendModule(relativePath) {
  const absolutePath = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'utils', relativePath);
  return import(pathToFileURL(absolutePath).href);
}

test('persisted ask reconciliation replaces optimistic messages without duplicates', async () => {
  const { reconcilePersistedAsk } = await importFrontendModule('chatMessages.js');
  const existing = [
    { id: 'user-temp', role: 'user', content: 'Question' },
    { id: 'assistant-temp', role: 'assistant', content: 'Partial', isStreaming: true },
  ];
  const persistedUser = { id: 101, role: 'user', content: 'Question' };
  const persistedAssistant = { id: 102, role: 'assistant', content: 'Complete answer' };
  const reconciled = reconcilePersistedAsk(existing, {
    optimisticUserId: 'user-temp',
    optimisticAssistantId: 'assistant-temp',
    persistedUser,
    persistedAssistant,
  });

  assert.deepEqual(reconciled.map((message) => message.id), [101, 102]);
  assert.equal(reconciled.filter((message) => message.role === 'assistant').length, 1);
  assert.equal(reconciled[1].content, 'Complete answer');
});

test('pending history keeps one placeholder until the persisted assistant exists', async () => {
  const {
    hasAssistantAfterUser,
    mergePendingHistory,
  } = await importFrontendModule('chatMessages.js');
  const cached = [
    { id: 'user-1', role: 'user', content: 'Question' },
    { id: 'assistant-stream-1', role: 'assistant', content: 'Partial' },
  ];
  const userOnlyHistory = [{ id: 201, role: 'user', content: 'Question' }];
  const completedHistory = [
    ...userOnlyHistory,
    { id: 202, role: 'assistant', content: 'Complete answer' },
  ];

  const pending = mergePendingHistory(userOnlyHistory, cached, 'Question');
  assert.deepEqual(pending.map((message) => message.id), [201, 'assistant-stream-1']);
  assert.equal(hasAssistantAfterUser(userOnlyHistory, 'Question'), false);
  assert.equal(hasAssistantAfterUser(completedHistory, 'Question'), true);
});

test('workspace message caches remain isolated by session', async () => {
  const cache = await importFrontendModule('workspaceCache.js');
  cache.cacheDocumentChat(10, { sessionId: 3 });
  cache.cacheSessionMessages(3, [{ id: 301, role: 'assistant', content: 'Session A' }]);
  cache.cacheDocumentChat(20, { sessionId: 2 });
  cache.cacheSessionMessages(2, [{ id: 201, role: 'assistant', content: 'Session B' }]);

  assert.equal(cache.getCachedDocumentChat(10).messages[0].content, 'Session A');
  assert.equal(cache.getCachedDocumentChat(20).messages[0].content, 'Session B');
  assert.equal(cache.getCachedSessionMessages(3).length, 1);
  assert.equal(cache.getCachedSessionMessages(2).length, 1);
});

test('an older history snapshot cannot remove a newer persisted assistant', async () => {
  const { mergeAuthoritativeHistory } = await importFrontendModule('chatMessages.js');
  const newerCache = [
    { id: 401, role: 'user', content: 'Question' },
    { id: 402, role: 'assistant', content: 'Completed answer' },
  ];
  const olderSnapshot = [{ id: 401, role: 'user', content: 'Question' }];
  const merged = mergeAuthoritativeHistory(olderSnapshot, newerCache);

  assert.deepEqual(merged.map((message) => message.id), [401, 402]);
  assert.equal(merged[1].content, 'Completed answer');
});
