const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const chatModel = require('../src/models/chat.model');
const documentService = require('../src/services/document.service');
const activityService = require('../src/services/activity.service');
const chatService = require('../src/services/chat.service');

function session(id, primaryDocumentId, documentIds = [primaryDocumentId]) {
  return {
    id,
    title: `Session ${id}`,
    user_id: 'user-1',
    primary_document_id: primaryDocumentId,
    created_at: '2026-06-22T00:00:00.000Z',
    updated_at: '2026-06-22T00:00:00.000Z',
    last_activity_at: '2026-06-22T00:00:00.000Z',
    chat_session_documents: documentIds.map((docId) => ({
      doc_id: docId,
      removed_at: null,
      documents: {
        id: docId,
        lifecycle_status: 'active',
        deleted_at: null,
        expires_at: null,
      },
    })),
  };
}

test('session lists are scoped by primary document, not attachments', async (t) => {
  const sessions = [
    session(1, 10, [10, 20]),
    session(2, 10),
    session(3, 20),
  ];
  const calls = [];
  t.mock.method(chatModel, 'listOwnedSessions', async (userId, primaryDocumentId) => {
    calls.push({ userId, primaryDocumentId });
    return sessions.filter((item) => item.primary_document_id === primaryDocumentId);
  });

  const documentA = await chatService.listSessions({ userId: 'user-1', documentId: 10 });
  const documentB = await chatService.listSessions({ userId: 'user-1', documentId: 20 });

  assert.deepEqual(documentA.sessions.map((item) => item.id), [1, 2]);
  assert.deepEqual(documentB.sessions.map((item) => item.id), [3]);
  assert.equal(documentA.sessions[0].primaryDocumentId, 10);
  assert.deepEqual(documentA.sessions[0].documentIds, [10, 20]);
  assert.deepEqual(calls, [
    { userId: 'user-1', primaryDocumentId: 10 },
    { userId: 'user-1', primaryDocumentId: 20 },
  ]);
});

test('new sessions store and attach the required primary document', async (t) => {
  const calls = { create: null, attached: null };
  const created = session(4, 10);
  t.mock.method(documentService, 'canAttachDocumentToSession', async () => ({ id: 10 }));
  t.mock.method(chatModel, 'createSession', async (...args) => {
    calls.create = args;
    return created;
  });
  t.mock.method(chatModel, 'attachDocuments', async (sessionId, documentIds) => {
    calls.attached = { sessionId, documentIds };
    return [];
  });
  t.mock.method(chatModel, 'findSessionById', async () => created);
  t.mock.method(chatModel, 'findOwnedSession', async () => created);
  t.mock.method(chatModel, 'getMessages', async () => []);
  t.mock.method(chatModel, 'listSessionDocuments', async () => []);
  t.mock.method(documentService, 'addThumbnailUrls', async (documents) => documents);
  t.mock.method(activityService, 'log', () => undefined);

  const payload = await chatService.createSession({
    userId: 'user-1',
    title: 'Document A chat',
    documentId: 10,
  });

  assert.deepEqual(calls.create, ['user-1', 'Document A chat', 10]);
  assert.deepEqual(calls.attached, { sessionId: 4, documentIds: [10] });
  assert.equal(payload.session.primaryDocumentId, 10);
});

test('creating or listing without a primary document is rejected', async () => {
  await assert.rejects(
    chatService.listSessions({ userId: 'user-1' }),
    /documentId is invalid/
  );
  await assert.rejects(
    chatService.createSession({ userId: 'user-1', title: 'Invalid' }),
    /documentId is invalid/
  );
});
