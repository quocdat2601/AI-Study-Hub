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
