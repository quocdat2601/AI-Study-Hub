const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'db', 'migrations', '026_chat_attachment_drag_drop.sql'), 'utf8');
const chatRoutes = fs.readFileSync(path.join(root, 'src', 'routes', 'chat.routes.js'), 'utf8');
const attachmentService = fs.readFileSync(path.join(root, 'src', 'services', 'session-attachment.service.js'), 'utf8');
const chatModel = fs.readFileSync(path.join(root, 'src', 'models', 'chat.model.js'), 'utf8');
const uploadMiddleware = fs.readFileSync(path.join(root, 'src', 'middleware', 'upload.js'), 'utf8');
const textService = fs.readFileSync(path.join(root, 'src', 'services', 'document-text.service.js'), 'utf8');

test('drag-drop migration raises the active session document limit to 20', () => {
  assert.match(migration, /active_count >= 20/);
  assert.match(migration, /20 active documents \(1 primary document and 19 attachments\)/);
  assert.match(migration, /upload_request_id UUID/);
  assert.match(migration, /\(session_id, upload_request_id\)/);
});

test('drag-drop migration provides stale-safe processing claims and expiry detaches links', () => {
  assert.match(migration, /claim_session_document_processing/);
  assert.match(migration, /ai_processing_claimed_at/);
  assert.match(migration, /make_interval\(secs => GREATEST\(p_stale_seconds, 60\)\)/);
  assert.match(migration, /UPDATE chat_session_documents csd SET removed_at = NOW\(\)/);
});

test('TXT is accepted by upload validation and extraction', () => {
  assert.match(uploadMiddleware, /'text\/plain'/);
  assert.match(textService, /TXT: 'text\/plain'/);
  assert.match(textService, /buffer\.toString\('utf8'\)/);
});

test('bulk temporary attachment endpoint is session scoped and idempotent', () => {
  assert.match(chatRoutes, /router\.delete\('\/sessions\/:sessionId\/documents\/temporary'/);
  assert.match(attachmentService, /removeTemporaryAttachments/);
  assert.match(attachmentService, /requireOwnedSession\(userId, sessionId\)/);
  assert.match(chatModel, /remove_temporary_session_attachments/);
  assert.match(attachmentService, /removedCount: documentIds\.length/);
});

test('recoverable permanent removal endpoints are session scoped', () => {
  assert.match(chatRoutes, /router\.delete\('\/sessions\/:sessionId\/documents\/recoverable'/);
  assert.match(chatRoutes, /router\.delete\('\/sessions\/:sessionId\/documents\/:documentId\/recoverable'/);
  assert.match(attachmentService, /permanentlyRemoveRecoverableAttachment/);
  assert.match(attachmentService, /permanentlyRemoveAllRecoverableAttachments/);
  assert.match(attachmentService, /requireOwnedSession\(userId, sessionId\)/);
  assert.match(chatModel, /permanently_remove_recoverable_session_attachments/);
});
