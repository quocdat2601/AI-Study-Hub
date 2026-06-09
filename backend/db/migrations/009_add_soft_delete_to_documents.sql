-- Soft-delete support for documents (trash + restore).
-- Owner soft-deletes (sets deleted_at -> moves to trash, file stays on cloud).
-- Admin can hard-delete (purge -> removes row + cloud file).
-- Additive & safe: nullable column, existing queries ignore it until updated.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Speed up filtering active (deleted_at IS NULL) vs trashed documents.
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at
  ON documents (deleted_at);
