-- Lightweight persisted document overviews generated from representative chunks.

CREATE TABLE IF NOT EXISTS document_overviews (
  id BIGSERIAL PRIMARY KEY,
  document_id INT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  file_id INT REFERENCES cloud_files(id) ON DELETE SET NULL,
  summary TEXT,
  document_type TEXT,
  purpose TEXT,
  key_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  outline JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_chunk_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'failed', 'stale')),
  error TEXT,
  provider TEXT,
  model TEXT,
  overview_version TEXT NOT NULL DEFAULT 'v1',
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_overviews_file_version
  ON document_overviews(file_id, overview_version)
  WHERE file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_overviews_status_updated
  ON document_overviews(status, updated_at);

CREATE OR REPLACE FUNCTION set_document_overviews_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_overviews_updated_at ON document_overviews;
CREATE TRIGGER trg_document_overviews_updated_at
BEFORE UPDATE ON document_overviews
FOR EACH ROW
EXECUTE FUNCTION set_document_overviews_updated_at();
