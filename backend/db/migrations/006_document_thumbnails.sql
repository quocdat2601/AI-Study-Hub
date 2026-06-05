-- Document thumbnail metadata for first-page previews.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS thumbnail_error TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  ALTER TABLE documents
    ADD CONSTRAINT documents_thumbnail_status_check
    CHECK (thumbnail_status IN ('pending', 'ready', 'failed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_public_trending
  ON documents (is_public, view_count DESC, created_at DESC);
