-- Allow multiple document rows to reference one physical cloud file.
-- Thumbnails are treated as file-level assets through the shared file_id.

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_file_id_key;

CREATE INDEX IF NOT EXISTS idx_documents_file_id
  ON documents (file_id);
