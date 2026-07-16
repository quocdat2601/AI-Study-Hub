const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const documentModel = require('../src/models/document.model');
const documentService = require('../src/services/document.service');
const activityService = require('../src/services/activity.service');

test('Admin Document Moderation — softDelete, restore, and purge logic', async (t) => {
  // Mock document data
  const mockDoc = {
    id: 101,
    title: 'Student Lecture Notes',
    user_id: 'student-user-123',
    document_scope: 'library',
    deleted_at: null,
    cloud_files: {
      storage_path: 'files/student-user-123/notes.pdf',
      size_bytes: 1024,
    },
  };

  // Trapped database updates/deletes to verify model actions
  let softDeleteParams = null;
  let restoreParams = null;
  let deleteParams = null;
  const activityLogs = [];

  // Mocks
  t.mock.method(documentModel, 'findById', async () => mockDoc);
  t.mock.method(documentModel, 'findAnyById', async () => mockDoc);

  t.mock.method(documentModel, 'softDelete', async (id, params) => {
    softDeleteParams = { id, ...params };
    return { ...mockDoc, deleted_at: new Date().toISOString(), ...params };
  });

  t.mock.method(documentModel, 'restore', async (id) => {
    restoreParams = { id };
    return { ...mockDoc, deleted_at: null, moderation_reason: null, moderated_by: null };
  });

  t.mock.method(documentModel, 'delete', async (id) => {
    deleteParams = { id };
    return true;
  });

  t.mock.method(documentModel, 'countDocumentsByFileId', async () => 0);
  t.mock.method(documentModel, 'deleteCloudFile', async () => true);
  t.mock.method(documentModel, 'countCloudFilesByStoragePath', async () => 0);

  t.mock.method(activityService, 'log', (log) => {
    activityLogs.push(log);
  });

  const chatSnapshotModel = require('../src/models/chat-snapshot.model');
  const chatModel = require('../src/models/chat.model');

  const supabaseService = require('../src/services/supabase.service');

  t.mock.method(chatSnapshotModel, 'findOwnedImportByLibraryDocument', async () => null);
  t.mock.method(chatModel, 'listActiveOwnedSessionsByPrimaryDocument', async () => []);
  t.mock.method(supabaseService, 'deleteFile', async () => true);
  t.mock.method(documentService, 'addThumbnailUrls', async (docs) => docs);

  // 1. Check: Normal user trying to soft-delete someone else's document (must FAIL with 403)
  await assert.rejects(
    documentService.softDeleteDocument({
      document: mockDoc,
      userId: 'other-student-456',
      isAdmin: false,
    }),
    /You can only delete your own documents/
  );

  // 2. Check: Admin soft-deletes someone else's document with reason (must SUCCEED)
  const softDeleteRes = await documentService.softDeleteDocument({
    document: mockDoc,
    userId: 'admin-user-999',
    isAdmin: true,
    reason: 'Inappropriate content',
  });
  assert.equal(softDeleteRes.documentDeleted, true);
  assert.deepEqual(softDeleteParams, {
    id: 101,
    moderationReason: 'Inappropriate content',
    moderatedBy: 'admin-user-999',
  });
  // Check that admin log action name is used
  assert.ok(activityLogs.some(log => log.action === 'admin.document.delete' && log.userId === 'admin-user-999'));

  // Prepare doc for restore/purge checks
  const mockTrashedDoc = { ...mockDoc, deleted_at: new Date().toISOString() };
  t.mock.method(documentModel, 'findAnyById', async () => mockTrashedDoc);

  // 3. Check: Normal user trying to restore someone else's document (must FAIL with 403)
  await assert.rejects(
    documentService.restoreDocument({
      id: 101,
      userId: 'other-student-456',
      isAdmin: false,
    }),
    /You can only restore your own documents/
  );

  // 4. Check: Admin restores someone else's document (must SUCCEED)
  const restoreRes = await documentService.restoreDocument({
    id: 101,
    userId: 'admin-user-999',
    isAdmin: true,
  });
  assert.equal(restoreRes.message, 'Document restored');
  assert.deepEqual(restoreParams, { id: 101 });
  assert.ok(activityLogs.some(log => log.action === 'admin.document.restore' && log.userId === 'admin-user-999'));

  // 5. Check: Normal user trying to purge someone else's document (must FAIL with 403)
  await assert.rejects(
    documentService.purgeDocument({
      id: 101,
      userId: 'other-student-456',
      isAdmin: false,
    }),
    /You can only permanently delete your own documents/
  );

  // 6. Check: Admin purges someone else's document (must SUCCEED)
  const purgeRes = await documentService.purgeDocument({
    id: 101,
    userId: 'admin-user-999',
    isAdmin: true,
  });
  assert.equal(purgeRes.message, 'Document permanently deleted');
  assert.deepEqual(deleteParams, { id: 101 });
  assert.ok(activityLogs.some(log => log.action === 'admin.document.purge' && log.userId === 'admin-user-999'));
});
