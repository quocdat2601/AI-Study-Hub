-- Add a simple document popularity counter for landing-page trending content.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE documents
    ADD CONSTRAINT documents_view_count_nonnegative CHECK (view_count >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_view_count_created
  ON documents (view_count DESC, created_at DESC);
