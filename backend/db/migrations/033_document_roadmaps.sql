-- Persisted AI-generated learning roadmaps per document, plus per-user step completion progress.

CREATE TABLE IF NOT EXISTS document_roadmaps (
  id BIGSERIAL PRIMARY KEY,
  document_id INT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  file_id INT REFERENCES cloud_files(id) ON DELETE SET NULL,
  title TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'failed', 'stale')),
  error TEXT,
  provider TEXT,
  model TEXT,
  roadmap_version TEXT NOT NULL DEFAULT 'v1',
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_roadmaps_file_version
  ON document_roadmaps(file_id, roadmap_version)
  WHERE file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_roadmaps_status_updated
  ON document_roadmaps(status, updated_at);

CREATE OR REPLACE FUNCTION set_document_roadmaps_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_roadmaps_updated_at ON document_roadmaps;
CREATE TRIGGER trg_document_roadmaps_updated_at
BEFORE UPDATE ON document_roadmaps
FOR EACH ROW
EXECUTE FUNCTION set_document_roadmaps_updated_at();

-- A row means the user completed that step; unticking deletes the row.
CREATE TABLE IF NOT EXISTS document_roadmap_progress (
  id BIGSERIAL PRIMARY KEY,
  roadmap_id BIGINT NOT NULL REFERENCES document_roadmaps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (roadmap_id, user_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_document_roadmap_progress_roadmap_user
  ON document_roadmap_progress(roadmap_id, user_id);

-- RLS nhất quán migration 002/017; backend dùng service-role nên bypass.
ALTER TABLE document_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_roadmap_progress ENABLE ROW LEVEL SECURITY;
