const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationPath = path.resolve(
  __dirname,
  '..',
  'db',
  'migrations',
  '020_session_document_cleanup.sql'
);
const migration = fs.readFileSync(migrationPath, 'utf8');
const correctiveMigration = fs.readFileSync(path.resolve(
  __dirname,
  '..',
  'db',
  'migrations',
  '027_session_lifecycle_and_bulk_attachment_cleanup.sql'
), 'utf8');
const recoverableRemovalMigration = fs.readFileSync(path.resolve(
  __dirname,
  '..',
  'db',
  'migrations',
  '028_recoverable_attachment_permanent_removal.sql'
), 'utf8');

test('lifecycle migration defines the complete state machine and retention windows', () => {
  assert.match(migration, /lifecycle_status IN \('active', 'expired', 'purging'\)/);
  assert.match(migration, /expires_at = p_accessed_at \+ INTERVAL '30 days'/);
  assert.match(migration, /purge_after = NOW\(\) \+ INTERVAL '7 days'/);
  assert.match(migration, /document_scope = 'session'/);
  assert.match(migration, /documents_library_lifecycle_check/);
});

test('purge claims are concurrent-worker safe and finalization is token guarded', () => {
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.match(migration, /purge_claim_token = p_claim_token/);
  assert.match(migration, /target\.purge_claim_token IS DISTINCT FROM p_claim_token/);
  assert.match(migration, /session_document_purge_log/);
});

test('storage cleanup is queued only after reference checks', () => {
  assert.match(migration, /storage_cleanup_queue/);
  assert.match(migration, /NOT EXISTS \(SELECT 1 FROM documents WHERE file_id = target_file_id\)/);
  assert.match(migration, /NOT EXISTS \([\s\S]*cloud_files WHERE storage_path = original_path/);
  assert.match(migration, /NOT EXISTS \([\s\S]*documents WHERE thumbnail_path = thumbnail_storage_path/);
});

test('lifecycle RPCs are restricted to the backend service role', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION restore_session_document[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION restore_session_document[\s\S]*TO service_role/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION finalize_session_document_purge[\s\S]*TO service_role/);
});

test('corrective lifecycle migration qualifies expired document output columns', () => {
  assert.match(correctiveMigration, /CREATE OR REPLACE FUNCTION expire_due_session_documents/);
  assert.match(correctiveMigration, /expired_docs AS/);
  assert.match(correctiveMigration, /d\.expired_at AS document_expired_at/);
  assert.match(correctiveMigration, /SELECT e\.document_id, e\.document_expired_at, e\.document_purge_after/);
  assert.doesNotMatch(correctiveMigration, /SELECT id, expired_at, purge_after FROM expired;/);
});

test('bulk temporary attachment cleanup excludes primary and library documents', () => {
  assert.match(correctiveMigration, /CREATE OR REPLACE FUNCTION remove_temporary_session_attachments/);
  assert.match(correctiveMigration, /csd\.doc_id IS DISTINCT FROM os\.primary_document_id/);
  assert.match(correctiveMigration, /d\.document_scope = 'session'/);
  assert.match(correctiveMigration, /d\.lifecycle_status = 'active'/);
  assert.match(correctiveMigration, /SET removed_at = NOW\(\)/);
});

test('recoverable permanent removal makes session documents immediately purge eligible', () => {
  assert.match(recoverableRemovalMigration, /permanently_remove_recoverable_session_attachments/);
  assert.match(recoverableRemovalMigration, /csd\.removed_at IS NOT NULL/);
  assert.match(recoverableRemovalMigration, /csd\.doc_id IS DISTINCT FROM os\.primary_document_id/);
  assert.match(recoverableRemovalMigration, /d\.document_scope = 'session'/);
  assert.match(recoverableRemovalMigration, /purge_after = NOW\(\)/);
  assert.match(recoverableRemovalMigration, /GRANT EXECUTE ON FUNCTION permanently_remove_recoverable_session_attachments/);
});
