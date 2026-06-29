const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const snapshotService = require('../src/services/chat-snapshot.service');
const snapshotModel = require('../src/models/chat-snapshot.model');
const snapshotController = require('../src/controllers/chat-snapshot.controller');
const chatService = require('../src/services/chat.service');
const chatModel = require('../src/models/chat.model');
const documentService = require('../src/services/document.service');
const activityService = require('../src/services/activity.service');

const migration = fs.readFileSync(path.resolve(
  __dirname, '..', 'db', 'migrations', '022_immutable_chat_snapshots.sql'
), 'utf8');
const fileThumbnailMigration = fs.readFileSync(path.resolve(
  __dirname, '..', 'db', 'migrations', '023_file_level_thumbnail_reuse.sql'
), 'utf8');
const linkAccessMigration = fs.readFileSync(path.resolve(
  __dirname, '..', 'db', 'migrations', '024_shared_link_access_state.sql'
), 'utf8');
const recipientMigration = fs.readFileSync(path.resolve(
  __dirname, '..', 'db', 'migrations', '025_shared_snapshot_recipients.sql'
), 'utf8');

test('snapshot sharing is disabled by default', () => {
  const previous = process.env.CHAT_SNAPSHOT_SHARING_ENABLED;
  delete process.env.CHAT_SNAPSHOT_SHARING_ENABLED;
  assert.equal(snapshotService.featureEnabled(), false);
  if (previous !== undefined) process.env.CHAT_SNAPSHOT_SHARING_ENABLED = previous;
});

test('snapshot schema has immutable identities, normalized citations, and one import per user', () => {
  assert.match(migration, /CREATE TABLE shared_file_versions/);
  assert.match(migration, /CREATE TABLE chat_snapshot_documents/);
  assert.match(migration, /CREATE TABLE chat_snapshot_messages/);
  assert.match(migration, /CREATE TABLE chat_snapshot_citations/);
  assert.match(migration, /UNIQUE \(snapshot_id, imported_by\)/);
  assert.match(migration, /document_scope IN \('library', 'session', 'shared'\)/);
});

test('file-level thumbnail migration allows shared cloud file references', () => {
  assert.match(fileThumbnailMigration, /DROP CONSTRAINT IF EXISTS documents_file_id_key/);
  assert.match(fileThumbnailMigration, /CREATE INDEX IF NOT EXISTS idx_documents_file_id/);
});

test('shared link access state is independent from immutable snapshot content', () => {
  assert.match(linkAccessMigration, /ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN/);
  assert.match(linkAccessMigration, /ADD COLUMN IF NOT EXISTS token_value TEXT/);
});

test('recipient references are lightweight and unique per snapshot/user', () => {
  assert.match(recipientMigration, /CREATE TABLE IF NOT EXISTS shared_snapshot_recipients/);
  assert.match(recipientMigration, /UNIQUE \(snapshot_id, user_id\)/);
  assert.doesNotMatch(recipientMigration, /chat_snapshot_messages/i);
  assert.doesNotMatch(recipientMigration, /chat_snapshot_documents/i);
});

test('session lifecycle and storage are pinned by retained snapshots', () => {
  assert.match(migration, /prevent_pinned_session_document_cleanup/);
  assert.match(migration, /s\.status IN \('creating', 'ready'\)/);
  assert.match(migration, /storage_cleanup_queue/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
});

test('legacy mutable links are revoked during migration', () => {
  assert.match(migration, /UPDATE chat_public_links SET revoked_at = COALESCE\(revoked_at, NOW\(\)\)/);
});

function sourceDocument(id, overrides = {}) {
  return {
    id,
    title: `Document ${id}`,
    user_id: 'user-1',
    is_public: false,
    extraction_status: 'ready',
    extraction_metadata: {},
    extracted_text: `Text ${id}`,
    cloud_files: {
      id: id + 100,
      storage_path: `user-1/${id}.pdf`,
      content_hash: `hash-${id}`,
      mime_type: 'application/pdf',
      size_bytes: 100,
    },
    ...overrides,
  };
}

test('snapshot capture forces the primary document and requires citation exclusion acknowledgement', async (t) => {
  process.env.CHAT_SNAPSHOT_SHARING_ENABLED = 'true';
  t.after(() => { process.env.CHAT_SNAPSHOT_SHARING_ENABLED = 'false'; });
  const documents = [sourceDocument(10), sourceDocument(20)];
  const messages = [{
    id: 1,
    role: 'assistant',
    content: 'Answer',
    created_at: '2026-06-24T00:00:00.000Z',
    metadata: { sources: [{ documentId: 20, chunkId: 200, content: 'Evidence' }] },
  }];
  t.mock.method(snapshotModel, 'findOwnedSession', async () => ({
    id: 30, user_id: 'user-1', title: 'Snapshot test', primary_document_id: 10,
  }));
  t.mock.method(snapshotModel, 'listActiveSourceDocuments', async () => documents);
  t.mock.method(snapshotModel, 'listMessages', async () => messages);

  await assert.rejects(
    snapshotService.createSnapshot({ sessionId: 30, ownerId: 'user-1', includedDocumentIds: [] }),
    (error) => error.statusCode === 409 && error.responseBody?.error === 'CITED_ATTACHMENTS_EXCLUDED'
  );

  t.mock.method(snapshotModel, 'createSnapshot', async () => ({ id: 'snapshot-1' }));
  t.mock.method(snapshotModel, 'upsertFileVersion', async (row) => ({ id: `file-${row.storage_path}` }));
  t.mock.method(snapshotModel, 'createSnapshotDocument', async (row) => ({ id: 'snapshot-doc-10', ...row }));
  t.mock.method(snapshotModel, 'listChunks', async () => []);
  t.mock.method(snapshotModel, 'createSnapshotChunks', async () => []);
  t.mock.method(snapshotModel, 'createSnapshotMessage', async (row) => ({ id: 1000, ...row }));
  t.mock.method(snapshotModel, 'createCitations', async () => []);
  t.mock.method(snapshotModel, 'createLink', async () => ({ id: 'link-1' }));
  t.mock.method(snapshotModel, 'updateSnapshot', async (_id, row) => row);
  t.mock.method(activityService, 'log', () => undefined);

  const result = await snapshotService.createSnapshot({
    sessionId: 30,
    ownerId: 'user-1',
    includedDocumentIds: [],
    acknowledgedExcludedCitationDocumentIds: [20],
  });
  assert.equal(result.snapshotId, 'snapshot-1');
  assert.equal(result.linkId, 'link-1');
  assert.match(result.path, /^\/shared\/chat\//);
});

test('re-import returns the existing independent fork instead of creating a duplicate', async (t) => {
  process.env.CHAT_SNAPSHOT_SHARING_ENABLED = 'true';
  t.after(() => { process.env.CHAT_SNAPSHOT_SHARING_ENABLED = 'false'; });
  t.mock.method(snapshotModel, 'findLinkByHash', async () => ({
    snapshot_id: 'snapshot-1',
    expires_at: '2099-01-01T00:00:00.000Z',
    disabled_at: null,
    chat_snapshots: { id: 'snapshot-1', status: 'ready' },
  }));
  t.mock.method(snapshotModel, 'findImport', async () => ({
    id: 'import-1', status: 'ready', fork_session_id: 77,
  }));
  t.mock.method(chatService, 'getMessages', async () => ({
    session: { id: 77 }, documents: [], messages: [], canWrite: true,
  }));

  const result = await snapshotService.importSnapshot({ token: 'token', userId: 'user-2' });
  assert.equal(result.session.id, 77);
  assert.equal(result.created, false);
});

test('snapshot import controller returns 201 for new imports and 200 for idempotent imports', async (t) => {
  function responseRecorder() {
    return {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
  }

  const nextCalls = [];
  const req = { params: { token: 'token' }, user: { id: 'user-2' } };

  t.mock.method(snapshotService, 'importSnapshot', async () => ({
    created: true,
    session: { id: 101 },
    documents: [],
    messages: [],
    canWrite: true,
  }));
  const createdResponse = responseRecorder();
  await snapshotController.importSnapshot(req, createdResponse, (error) => nextCalls.push(error));
  assert.equal(createdResponse.statusCode, 201);
  assert.equal(createdResponse.body.created, true);
  assert.equal(createdResponse.body.session.id, 101);

  snapshotService.importSnapshot.mock.mockImplementation(async () => ({
    created: false,
    session: { id: 101 },
    documents: [],
    messages: [],
    canWrite: true,
  }));
  const existingResponse = responseRecorder();
  await snapshotController.importSnapshot(req, existingResponse, (error) => nextCalls.push(error));
  assert.equal(existingResponse.statusCode, 200);
  assert.equal(existingResponse.body.created, false);
  assert.equal(existingResponse.body.session.id, 101);
  assert.deepEqual(nextCalls, []);
});

test('anonymous snapshot preview exposes only sanitized citation excerpts and public metadata', async (t) => {
  process.env.CHAT_SNAPSHOT_SHARING_ENABLED = 'true';
  t.after(() => { process.env.CHAT_SNAPSHOT_SHARING_ENABLED = 'false'; });

  const fullChunkText = `FULL_CHUNK_SECRET ${'private evidence '.repeat(80)}END_SECRET`;
  t.mock.method(snapshotModel, 'findLinkByHash', async () => ({
    snapshot_id: 'snapshot-1',
    expires_at: '2099-01-01T00:00:00.000Z',
    disabled_at: null,
    chat_snapshots: {
      id: 'snapshot-1',
      title: 'Public preview',
      status: 'ready',
      created_at: '2026-06-24T00:00:00.000Z',
    },
  }));
  t.mock.method(snapshotModel, 'listSnapshotDocuments', async () => ([{
    id: 'snapshot-doc-1',
    title: 'Snapshot document',
    is_primary: true,
    extraction_status: 'ready',
    extracted_text: 'EXTRACTED_TEXT_SHOULD_NOT_LEAK',
    document_metadata: {
      mimeType: 'application/pdf',
      sizeBytes: 123,
      storage_path: 'private/path.pdf',
      content_hash: 'hash-should-not-leak',
    },
    shared_file_versions: {
      storage_path: 'private/path.pdf',
      content_hash: 'hash-should-not-leak',
    },
  }]));
  t.mock.method(snapshotModel, 'listSnapshotMessages', async () => ([{
    id: 'snapshot-message-1',
    role: 'assistant',
    content: 'Answer',
    original_created_at: '2026-06-24T00:01:00.000Z',
    metadata: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      mode: 'hybrid',
      retrieval: 'hybrid',
      substantiveQuestion: 'internal rewritten question',
      processingError: 'internal processing detail',
      sources: [{ content: fullChunkText }],
      omittedCitationCount: 0,
    },
    chat_snapshot_citations: [{
      snapshot_document_id: 'snapshot-doc-1',
      snapshot_chunk_id: 'snapshot-chunk-1',
      page_start: 2,
      page_end: 3,
      score: 0.82,
      excerpt: fullChunkText,
      chat_snapshot_documents: {
        id: 'snapshot-doc-1',
        title: 'Snapshot document',
        source_document_id: 42,
      },
      chat_snapshot_document_chunks: {
        id: 'snapshot-chunk-1',
        source_chunk_id: 99,
        chunk_index: 4,
        content: fullChunkText,
        embedding: [0.1, 0.2, 0.3],
        metadata: { retrieval: 'hybrid' },
      },
    }],
  }]));

  const result = await snapshotService.getPublicPreview('token');
  const serialized = JSON.stringify(result);
  const [message] = result.messages;
  const [source] = message.sources;

  assert.deepEqual(message.metadata, {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    mode: 'hybrid',
    omittedCitationCount: 0,
  });
  assert.equal(source.content, undefined);
  assert.equal(typeof source.excerpt, 'string');
  assert.ok(source.excerpt.length <= 400);
  assert.match(source.excerpt, /^FULL_CHUNK_SECRET/);
  assert.doesNotMatch(source.excerpt, /END_SECRET/);
  assert.equal(source.documentId, 'snapshot-doc-1');
  assert.equal(source.documentTitle, 'Snapshot document');
  assert.equal(source.chunkIndex, 4);
  assert.equal(source.pageStart, 2);
  assert.equal(source.score, 0.82);

  assert.doesNotMatch(serialized, /storage_path|content_hash|extracted_text|embedding|source_document_id|source_chunk_id/);
  assert.doesNotMatch(serialized, /retrieval|substantiveQuestion|processingError/);
  assert.doesNotMatch(serialized, /END_SECRET/);
});

test('a restricted link denies anonymous preview without changing its frozen snapshot', async (t) => {
  process.env.CHAT_SNAPSHOT_SHARING_ENABLED = 'true';
  t.after(() => { process.env.CHAT_SNAPSHOT_SHARING_ENABLED = 'false'; });
  t.mock.method(snapshotModel, 'findLinkByHash', async () => ({
    snapshot_id: 'snapshot-1',
    is_enabled: false,
    disabled_at: '2026-06-25T00:00:00.000Z',
    expires_at: '2099-01-01T00:00:00.000Z',
    chat_snapshots: { status: 'ready' },
  }));
  await assert.rejects(
    snapshotService.getPublicPreview('token'),
    (error) => error.statusCode === 410 && error.message === 'SHARE_UNAVAILABLE'
  );
});

test('an authenticated recipient opening a link records a reference without importing a fork', async (t) => {
  process.env.CHAT_SNAPSHOT_SHARING_ENABLED = 'true';
  t.after(() => { process.env.CHAT_SNAPSHOT_SHARING_ENABLED = 'false'; });
  t.mock.method(snapshotModel, 'findLinkByHash', async () => ({
    id: 'link-1', snapshot_id: 'snapshot-1', created_by: 'owner-1', is_enabled: true,
    expires_at: '2099-01-01T00:00:00.000Z', disabled_at: null,
    created_at: '2026-06-26T00:00:00.000Z', token_value: 'token',
    chat_snapshots: { title: 'Frozen chat', source_session_id: null, status: 'ready' },
  }));
  const opened = [];
  t.mock.method(snapshotModel, 'upsertRecipient', async (row) => { opened.push(row); return { id: 'recipient-1', first_opened_at: '2026-06-26T00:00:00.000Z', last_opened_at: '2026-06-26T00:00:00.000Z' }; });
  t.mock.method(snapshotModel, 'listSnapshotDocuments', async () => []);
  t.mock.method(snapshotModel, 'listSnapshotMessages', async () => []);

  const result = await snapshotService.registerRecipientOpen({ token: 'token', userId: 'recipient-user' });
  assert.equal(result.recorded, true);
  assert.deepEqual(opened, [{ snapshotId: 'snapshot-1', linkId: 'link-1', userId: 'recipient-user' }]);
  assert.equal(result.link.title, 'Frozen chat');
});

test('deleting an imported primary library document removes only its owned fork session', async (t) => {
  t.mock.method(snapshotModel, 'findOwnedImportByLibraryDocument', async () => ({
    import_id: 'import-1',
    chat_snapshot_imports: { fork_session_id: 35 },
  }));
  t.mock.method(chatModel, 'findOwnedSession', async () => ({
    id: 35, user_id: 'user-2', primary_document_id: 510,
  }));
  const removed = [];
  t.mock.method(chatModel, 'softRemoveAllSessionDocuments', async (sessionId) => { removed.push(sessionId); return [{ doc_id: 510 }, { doc_id: 520 }]; });
  const deleted = [];
  t.mock.method(chatModel, 'softDeleteOwnedSession', async (sessionId) => { deleted.push(sessionId); return { id: sessionId }; });
  t.mock.method(activityService, 'log', () => undefined);

  const sessionId = await documentService.deleteImportedForkForPrimaryDocument({
    document: { id: 510 }, userId: 'user-2',
  });
  assert.equal(sessionId, 35);
  assert.deepEqual(removed, [35]);
  assert.deepEqual(deleted, [35]);
});

test('saving an imported primary document promotes only its fork session and keeps other attachments', async (t) => {
  t.mock.method(snapshotModel, 'findOwnedImportDocumentBySnapshotDocument', async () => ({
    import_id: 'import-1',
    snapshot_document_id: 'snapshot-primary',
    chat_snapshot_documents: { is_primary: true },
    chat_snapshot_imports: { fork_session_id: 35 },
  }));
  t.mock.method(chatModel, 'findOwnedSession', async () => ({
    id: 35, user_id: 'user-2', primary_document_id: 410,
  }));
  const attached = [];
  t.mock.method(chatModel, 'attachDocuments', async (sessionId, docIds) => { attached.push([sessionId, docIds]); });
  t.mock.method(chatModel, 'updateOwnedSessionPrimaryDocument', async (_sessionId, _userId, docId) => ({ id: 35, primary_document_id: docId }));
  const removed = [];
  t.mock.method(chatModel, 'softRemoveSessionDocument', async (sessionId, docId) => { removed.push([sessionId, docId]); });
  const remapped = [];
  t.mock.method(snapshotModel, 'updateImportDocumentFork', async (row) => { remapped.push(row); });

  const result = await snapshotService.promoteImportedPrimaryDocument({
    source: { id: 410, source_snapshot_document_id: 'snapshot-primary' }, document: { id: 510 }, userId: 'user-2',
  });

  assert.deepEqual(result, { sessionUpdated: true, sessionId: 35 });
  assert.deepEqual(attached, [[35, [510]]]);
  assert.deepEqual(removed, [[35, 410]]);
  assert.deepEqual(remapped, [{ importId: 'import-1', snapshotDocumentId: 'snapshot-primary', forkDocumentId: 510 }]);
});

test('saving an imported attachment does not change the fork session primary document', async (t) => {
  t.mock.method(snapshotModel, 'findOwnedImportDocumentBySnapshotDocument', async () => ({
    chat_snapshot_documents: { is_primary: false },
  }));
  const result = await snapshotService.promoteImportedPrimaryDocument({
    source: { id: 420, source_snapshot_document_id: 'snapshot-attachment' }, document: { id: 520 }, userId: 'user-2',
  });
  assert.deepEqual(result, { sessionUpdated: false, sessionId: null });
});

test('re-saving a restored imported primary keeps the existing fork session association', async (t) => {
  t.mock.method(snapshotModel, 'findOwnedImportDocumentBySnapshotDocument', async () => ({
    import_id: 'import-1',
    snapshot_document_id: 'snapshot-primary',
    chat_snapshot_documents: { is_primary: true },
    chat_snapshot_imports: { fork_session_id: 35 },
  }));
  t.mock.method(chatModel, 'findOwnedSession', async () => ({
    id: 35, user_id: 'user-2', primary_document_id: 510,
  }));

  const result = await snapshotService.promoteImportedPrimaryDocument({
    source: { id: 410, source_snapshot_document_id: 'snapshot-primary' },
    document: { id: 510 },
    userId: 'user-2',
  });

  assert.deepEqual(result, { sessionUpdated: true, sessionId: 35 });
});

test('a soft-deleted saved library document is restored instead of returned as deleted', async (t) => {
  const documentModel = require('../src/models/document.model');
  t.mock.method(documentModel, 'restore', async (id) => ({
    id,
    user_id: 'user-2',
    document_scope: 'library',
    deleted_at: null,
    lifecycle_status: 'active',
    expires_at: null,
    purge_after: null,
  }));

  const result = await snapshotService.restoreExistingLibraryDocument({
    id: 510,
    user_id: 'user-2',
    document_scope: 'library',
    deleted_at: '2026-06-24T00:00:00.000Z',
    lifecycle_status: 'active',
  }, 'user-2');

  assert.equal(result.restored, true);
  assert.equal(result.document.deleted_at, null);
  assert.equal(result.document.lifecycle_status, 'active');
});

test('an active saved library document is reused without another restore', async () => {
  const active = { id: 510, user_id: 'user-2', document_scope: 'library', deleted_at: null };
  const result = await snapshotService.restoreExistingLibraryDocument(active, 'user-2');
  assert.deepEqual(result, { document: active, restored: false });
});
