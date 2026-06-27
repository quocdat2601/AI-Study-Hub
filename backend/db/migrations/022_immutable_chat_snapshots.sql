-- Immutable, link-addressable chat snapshots and recipient-owned forks.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE shared_file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_kind VARCHAR(20) NOT NULL DEFAULT 'original'
    CHECK (object_kind IN ('original', 'thumbnail')),
  source_cloud_file_id INT REFERENCES cloud_files(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  content_hash TEXT,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (object_kind = 'thumbnail' OR content_hash IS NOT NULL)
);

CREATE UNIQUE INDEX idx_shared_file_versions_original
  ON shared_file_versions (content_hash, storage_path, object_kind)
  WHERE object_kind = 'original';

CREATE UNIQUE INDEX idx_shared_file_versions_path_kind
  ON shared_file_versions (storage_path, object_kind);

CREATE TABLE chat_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_session_id INT REFERENCES chat_sessions(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  source_session_updated_at TIMESTAMPTZ,
  source_message_cutoff_id INT,
  status VARCHAR(20) NOT NULL DEFAULT 'creating'
    CHECK (status IN ('creating', 'ready', 'failed', 'purging')),
  failure_error TEXT,
  cleanup_eligible_at TIMESTAMPTZ,
  purge_claim_token UUID,
  purge_claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at TIMESTAMPTZ
);

CREATE TABLE chat_snapshot_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES chat_snapshots(id) ON DELETE CASCADE,
  source_document_id INT REFERENCES documents(id) ON DELETE SET NULL,
  file_version_id UUID NOT NULL REFERENCES shared_file_versions(id) ON DELETE RESTRICT,
  thumbnail_file_version_id UUID REFERENCES shared_file_versions(id) ON DELETE RESTRICT,
  ordinal INT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  title VARCHAR(255) NOT NULL,
  document_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_text TEXT,
  extraction_status VARCHAR(20),
  extraction_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_id, ordinal),
  UNIQUE (snapshot_id, source_document_id)
);

CREATE UNIQUE INDEX idx_chat_snapshot_primary_document
  ON chat_snapshot_documents (snapshot_id)
  WHERE is_primary = TRUE;

CREATE INDEX idx_chat_snapshot_documents_source
  ON chat_snapshot_documents (source_document_id)
  WHERE source_document_id IS NOT NULL;

CREATE TABLE chat_snapshot_document_chunks (
  id BIGSERIAL PRIMARY KEY,
  snapshot_document_id UUID NOT NULL REFERENCES chat_snapshot_documents(id) ON DELETE CASCADE,
  source_chunk_id INT,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  token_estimate INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding extensions.vector(768),
  embedding_model TEXT,
  embedding_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_document_id, chunk_index)
);

CREATE TABLE chat_snapshot_messages (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES chat_snapshots(id) ON DELETE CASCADE,
  source_message_id INT,
  ordinal INT NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  original_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_id, ordinal)
);

CREATE TABLE chat_snapshot_citations (
  id BIGSERIAL PRIMARY KEY,
  snapshot_message_id BIGINT NOT NULL REFERENCES chat_snapshot_messages(id) ON DELETE CASCADE,
  snapshot_document_id UUID NOT NULL REFERENCES chat_snapshot_documents(id) ON DELETE CASCADE,
  snapshot_chunk_id BIGINT REFERENCES chat_snapshot_document_chunks(id) ON DELETE SET NULL,
  page_start INT,
  page_end INT,
  score DOUBLE PRECISION,
  retrieval_type TEXT,
  excerpt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_message_id, snapshot_document_id, snapshot_chunk_id)
);

CREATE TABLE chat_snapshot_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES chat_snapshots(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  disabled_at TIMESTAMPTZ,
  disabled_reason TEXT
);

CREATE INDEX idx_chat_snapshot_links_creator
  ON chat_snapshot_links (created_by, created_at DESC);

CREATE TABLE chat_snapshot_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES chat_snapshots(id) ON DELETE CASCADE,
  imported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fork_session_id INT REFERENCES chat_sessions(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'creating'
    CHECK (status IN ('creating', 'ready', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at TIMESTAMPTZ,
  UNIQUE (snapshot_id, imported_by)
);

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_scope_check;
ALTER TABLE documents
  ADD COLUMN source_snapshot_document_id UUID REFERENCES chat_snapshot_documents(id) ON DELETE SET NULL,
  ADD CONSTRAINT documents_scope_check
    CHECK (document_scope IN ('library', 'session', 'shared'));

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_session_origin_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_session_origin_check CHECK (
    (document_scope = 'session' AND origin_session_id IS NOT NULL)
    OR (document_scope <> 'session' AND origin_session_id IS NULL)
  );

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_session_private_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_session_private_check
    CHECK (document_scope = 'library' OR is_public = FALSE);

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_library_lifecycle_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_library_lifecycle_check CHECK (
    document_scope = 'session'
    OR (
      lifecycle_status = 'active'
      AND expires_at IS NULL
      AND expired_at IS NULL
      AND purge_after IS NULL
      AND purge_claim_token IS NULL
      AND purge_claimed_at IS NULL
    )
  );

CREATE TABLE chat_snapshot_import_documents (
  import_id UUID NOT NULL REFERENCES chat_snapshot_imports(id) ON DELETE CASCADE,
  snapshot_document_id UUID NOT NULL REFERENCES chat_snapshot_documents(id) ON DELETE CASCADE,
  fork_document_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (import_id, snapshot_document_id),
  UNIQUE (fork_document_id)
);

CREATE TABLE document_provenance (
  document_id INT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('shared_snapshot')),
  snapshot_document_id UUID NOT NULL REFERENCES chat_snapshot_documents(id) ON DELETE RESTRICT,
  import_id UUID REFERENCES chat_snapshot_imports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_document_id, import_id)
);

CREATE INDEX idx_documents_shared_owner
  ON documents (user_id, created_at DESC)
  WHERE document_scope = 'shared' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION prevent_shared_file_version_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.object_kind, OLD.storage_path, OLD.content_hash, OLD.mime_type, OLD.size_bytes)
    IS DISTINCT FROM
    ROW(NEW.object_kind, NEW.storage_path, NEW.content_hash, NEW.mime_type, NEW.size_bytes) THEN
    RAISE EXCEPTION 'Shared file versions are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shared_file_versions_immutable
BEFORE UPDATE ON shared_file_versions
FOR EACH ROW EXECUTE FUNCTION prevent_shared_file_version_mutation();

CREATE OR REPLACE FUNCTION prevent_pinned_session_document_cleanup()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.document_scope = 'session'
    AND NEW.lifecycle_status IN ('expired', 'purging')
    AND EXISTS (
      SELECT 1
      FROM chat_snapshot_documents sd
      JOIN chat_snapshots s ON s.id = sd.snapshot_id
      WHERE sd.source_document_id = OLD.id
        AND s.status IN ('creating', 'ready')
    ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_documents_snapshot_lifecycle_pin
BEFORE UPDATE OF lifecycle_status ON documents
FOR EACH ROW EXECUTE FUNCTION prevent_pinned_session_document_cleanup();

CREATE OR REPLACE FUNCTION claim_chat_snapshots_for_purge(
  p_batch_size INT,
  p_claim_token UUID,
  p_lease_seconds INT DEFAULT 1800
)
RETURNS TABLE (snapshot_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT s.id
    FROM chat_snapshots s
    WHERE NOT EXISTS (
      SELECT 1 FROM chat_snapshot_imports i
      WHERE i.snapshot_id = s.id AND i.status = 'ready'
    )
      AND (
        (s.status IN ('ready', 'failed') AND s.cleanup_eligible_at <= NOW())
        OR (s.status = 'purging' AND s.purge_claimed_at < NOW() - make_interval(secs => p_lease_seconds))
      )
    ORDER BY s.cleanup_eligible_at, s.id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size, 50), 1), 500)
  )
  UPDATE chat_snapshots s
  SET status = 'purging', purge_claim_token = p_claim_token, purge_claimed_at = NOW()
  FROM candidates c
  WHERE s.id = c.id
  RETURNING s.id;
END;
$$;

CREATE OR REPLACE FUNCTION finalize_chat_snapshot_purge(
  p_snapshot_id UUID,
  p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted_count INT;
  file_row RECORD;
BEGIN
  DELETE FROM chat_snapshots s
  WHERE s.id = p_snapshot_id
    AND s.status = 'purging'
    AND s.purge_claim_token = p_claim_token
    AND NOT EXISTS (
      SELECT 1 FROM chat_snapshot_imports i
      WHERE i.snapshot_id = s.id AND i.status = 'ready'
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  FOR file_row IN
    SELECT fv.id, fv.storage_path, fv.object_kind
    FROM shared_file_versions fv
    WHERE NOT EXISTS (
      SELECT 1 FROM chat_snapshot_documents sd
      WHERE sd.file_version_id = fv.id OR sd.thumbnail_file_version_id = fv.id
    )
      AND NOT EXISTS (SELECT 1 FROM cloud_files cf WHERE cf.storage_path = fv.storage_path)
  LOOP
    INSERT INTO storage_cleanup_queue (storage_path, object_kind)
    VALUES (file_row.storage_path, file_row.object_kind)
    ON CONFLICT (storage_path, object_kind)
      WHERE status IN ('pending', 'processing') DO NOTHING;
  END LOOP;
  DELETE FROM shared_file_versions fv
  WHERE NOT EXISTS (SELECT 1 FROM chat_snapshot_documents sd WHERE sd.file_version_id = fv.id OR sd.thumbnail_file_version_id = fv.id);
  RETURN deleted_count = 1;
END;
$$;

ALTER TABLE shared_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_snapshot_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_snapshot_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_snapshot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_snapshot_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_snapshot_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_snapshot_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_snapshot_import_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_provenance ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON shared_file_versions, chat_snapshots, chat_snapshot_documents,
  chat_snapshot_document_chunks, chat_snapshot_messages, chat_snapshot_citations,
  chat_snapshot_links, chat_snapshot_imports, chat_snapshot_import_documents,
  document_provenance FROM anon, authenticated;
REVOKE ALL ON FUNCTION claim_chat_snapshots_for_purge(INT, UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION finalize_chat_snapshot_purge(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_chat_snapshots_for_purge(INT, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION finalize_chat_snapshot_purge(UUID, UUID) TO service_role;

-- Legacy public links exposed mutable sessions. They are intentionally disabled.
UPDATE chat_public_links SET revoked_at = COALESCE(revoked_at, NOW());
