-- Sliding expiry, recovery, and retryable purge for session-only documents.

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_lifecycle_status_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_lifecycle_status_check
  CHECK (lifecycle_status IN ('active', 'expired', 'purging'));

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS purge_claim_token UUID,
  ADD COLUMN IF NOT EXISTS purge_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_cleanup_error TEXT;

UPDATE documents
SET
  lifecycle_status = 'active',
  expires_at = NULL,
  expired_at = NULL,
  purge_after = NULL,
  purge_claim_token = NULL,
  purge_claimed_at = NULL,
  last_cleanup_error = NULL
WHERE document_scope = 'library';

UPDATE documents
SET
  last_accessed_at = COALESCE(last_accessed_at, NOW()),
  expires_at = COALESCE(expires_at, NOW() + INTERVAL '30 days')
WHERE document_scope = 'session'
  AND lifecycle_status = 'active';

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

CREATE INDEX IF NOT EXISTS idx_documents_session_expired_purge
  ON documents (purge_after, id)
  WHERE document_scope = 'session'
    AND lifecycle_status = 'expired'
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_session_purge_claim
  ON documents (purge_claimed_at, id)
  WHERE document_scope = 'session'
    AND lifecycle_status = 'purging'
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_session_documents_active_doc
  ON chat_session_documents (doc_id, session_id)
  WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS storage_cleanup_queue (
  id BIGSERIAL PRIMARY KEY,
  storage_path TEXT NOT NULL,
  object_kind VARCHAR(20) NOT NULL CHECK (object_kind IN ('original', 'thumbnail')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  claim_token UUID,
  claimed_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_cleanup_queue_active_path
  ON storage_cleanup_queue (storage_path, object_kind)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_storage_cleanup_queue_due
  ON storage_cleanup_queue (next_attempt_at, id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_storage_cleanup_queue_claim
  ON storage_cleanup_queue (claimed_at, id)
  WHERE status = 'processing';

CREATE TABLE IF NOT EXISTS session_document_purge_log (
  id BIGSERIAL PRIMARY KEY,
  session_id INT NOT NULL,
  document_id INT NOT NULL,
  user_id UUID,
  title VARCHAR(255),
  claim_token UUID NOT NULL,
  purged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_session_document_purge_lookup
  ON session_document_purge_log (session_id, document_id);

CREATE OR REPLACE FUNCTION touch_session_documents(
  p_document_ids INT[],
  p_accessed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (document_id INT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE documents d
  SET
    last_accessed_at = p_accessed_at,
    expires_at = p_accessed_at + INTERVAL '30 days',
    updated_at = p_accessed_at
  WHERE d.id = ANY(COALESCE(p_document_ids, ARRAY[]::INT[]))
    AND d.document_scope = 'session'
    AND d.lifecycle_status = 'active'
    AND d.deleted_at IS NULL
    AND (d.expires_at IS NULL OR d.expires_at > p_accessed_at)
  RETURNING d.id, d.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION expire_due_session_documents(p_batch_size INT DEFAULT 100)
RETURNS TABLE (document_id INT, expired_at TIMESTAMPTZ, purge_after TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT d.id
    FROM documents d
    WHERE d.document_scope = 'session'
      AND d.lifecycle_status = 'active'
      AND d.deleted_at IS NULL
      AND d.expires_at IS NOT NULL
      AND d.expires_at <= NOW()
    ORDER BY d.expires_at, d.id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size, 100), 1), 1000)
  )
  UPDATE documents d
  SET
    lifecycle_status = 'expired',
    expired_at = NOW(),
    purge_after = NOW() + INTERVAL '7 days',
    purge_claim_token = NULL,
    purge_claimed_at = NULL,
    last_cleanup_error = NULL,
    updated_at = NOW()
  FROM candidates c
  WHERE d.id = c.id
  RETURNING d.id, d.expired_at, d.purge_after;
END;
$$;

CREATE OR REPLACE FUNCTION claim_session_documents_for_purge(
  p_batch_size INT,
  p_claim_token UUID,
  p_lease_seconds INT DEFAULT 1800
)
RETURNS TABLE (
  document_id INT,
  session_id INT,
  user_id UUID,
  title VARCHAR,
  was_reclaimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT
      d.id,
      d.lifecycle_status = 'purging' AS was_reclaimed
    FROM documents d
    WHERE d.document_scope = 'session'
      AND d.deleted_at IS NULL
      AND (
        (d.lifecycle_status = 'expired' AND d.purge_after <= NOW())
        OR (
          d.lifecycle_status = 'purging'
          AND d.purge_claimed_at < NOW() - make_interval(secs => LEAST(GREATEST(p_lease_seconds, 60), 86400))
        )
      )
    ORDER BY COALESCE(d.purge_after, d.purge_claimed_at), d.id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size, 50), 1), 500)
  )
  UPDATE documents d
  SET
    lifecycle_status = 'purging',
    purge_claim_token = p_claim_token,
    purge_claimed_at = NOW(),
    purge_attempts = d.purge_attempts + 1,
    last_cleanup_error = NULL,
    updated_at = NOW()
  FROM candidates c
  WHERE d.id = c.id
  RETURNING d.id, d.origin_session_id, d.user_id, d.title, c.was_reclaimed;
END;
$$;

CREATE OR REPLACE FUNCTION finalize_session_document_purge(
  p_document_id INT,
  p_claim_token UUID
)
RETURNS TABLE (finalized BOOLEAN, original_queued BOOLEAN, thumbnail_queued BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target documents%ROWTYPE;
  original_path TEXT;
  thumbnail_storage_path TEXT;
  target_file_id INT;
  queued_original BOOLEAN := FALSE;
  queued_thumbnail BOOLEAN := FALSE;
BEGIN
  SELECT * INTO target
  FROM documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT EXISTS (
      SELECT 1 FROM session_document_purge_log
      WHERE document_id = p_document_id AND claim_token = p_claim_token
    ), FALSE, FALSE;
    RETURN;
  END IF;

  IF target.document_scope <> 'session'
    OR target.lifecycle_status <> 'purging'
    OR target.purge_claim_token IS DISTINCT FROM p_claim_token THEN
    RETURN QUERY SELECT FALSE, FALSE, FALSE;
    RETURN;
  END IF;

  target_file_id := target.file_id;
  thumbnail_storage_path := target.thumbnail_path;
  SELECT storage_path INTO original_path FROM cloud_files WHERE id = target_file_id;

  INSERT INTO session_document_purge_log (
    session_id, document_id, user_id, title, claim_token, purged_at
  ) VALUES (
    target.origin_session_id, target.id, target.user_id, target.title, p_claim_token, NOW()
  ) ON CONFLICT (document_id) DO NOTHING;

  DELETE FROM documents WHERE id = target.id;
  IF NOT EXISTS (SELECT 1 FROM documents WHERE file_id = target_file_id) THEN
    DELETE FROM cloud_files WHERE id = target_file_id;
  END IF;

  IF original_path IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM cloud_files WHERE storage_path = original_path
  ) THEN
    INSERT INTO storage_cleanup_queue (storage_path, object_kind)
    VALUES (original_path, 'original')
    ON CONFLICT (storage_path, object_kind)
      WHERE status IN ('pending', 'processing') DO NOTHING;
    queued_original := TRUE;
  END IF;

  IF thumbnail_storage_path IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM documents WHERE thumbnail_path = thumbnail_storage_path
  ) THEN
    INSERT INTO storage_cleanup_queue (storage_path, object_kind)
    VALUES (thumbnail_storage_path, 'thumbnail')
    ON CONFLICT (storage_path, object_kind)
      WHERE status IN ('pending', 'processing') DO NOTHING;
    queued_thumbnail := TRUE;
  END IF;

  RETURN QUERY SELECT TRUE, queued_original, queued_thumbnail;
END;
$$;

CREATE OR REPLACE FUNCTION claim_storage_cleanup_items(
  p_batch_size INT,
  p_claim_token UUID,
  p_lease_seconds INT DEFAULT 1800
)
RETURNS TABLE (queue_id BIGINT, storage_path TEXT, object_kind VARCHAR, attempts INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM storage_cleanup_queue q
    WHERE (
      q.status = 'pending' AND q.next_attempt_at <= NOW()
    ) OR (
      q.status = 'processing'
      AND q.claimed_at < NOW() - make_interval(secs => LEAST(GREATEST(p_lease_seconds, 60), 86400))
    )
    ORDER BY q.next_attempt_at, q.id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size, 50), 1), 500)
  )
  UPDATE storage_cleanup_queue q
  SET
    status = 'processing',
    claim_token = p_claim_token,
    claimed_at = NOW(),
    attempts = q.attempts + 1,
    last_error = NULL
  FROM candidates c
  WHERE q.id = c.id
  RETURNING q.id, q.storage_path, q.object_kind, q.attempts;
END;
$$;

CREATE OR REPLACE FUNCTION restore_session_document(
  p_session_id INT,
  p_document_id INT,
  p_user_id UUID
)
RETURNS TABLE (document_id INT, lifecycle_status VARCHAR, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target documents%ROWTYPE;
  link chat_session_documents%ROWTYPE;
  active_count INT;
BEGIN
  SELECT * INTO target FROM documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR target.document_scope <> 'session'
    OR target.origin_session_id <> p_session_id
    OR target.user_id IS DISTINCT FROM p_user_id THEN
    RETURN;
  END IF;
  IF target.lifecycle_status = 'purging' THEN
    RAISE EXCEPTION 'Session attachment cleanup is in progress' USING ERRCODE = '55000';
  END IF;
  IF target.lifecycle_status = 'expired'
    AND (target.purge_after IS NULL OR target.purge_after <= NOW()) THEN
    RAISE EXCEPTION 'Session attachment recovery window has ended' USING ERRCODE = '55000';
  END IF;
  IF target.lifecycle_status = 'active'
    AND target.expires_at IS NOT NULL AND target.expires_at <= NOW()
    AND target.expires_at + INTERVAL '7 days' <= NOW() THEN
    RAISE EXCEPTION 'Session attachment recovery window has ended' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO link
  FROM chat_session_documents
  WHERE session_id = p_session_id AND doc_id = p_document_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF link.removed_at IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(15401, p_session_id);
    SELECT COUNT(*) INTO active_count
    FROM chat_session_documents
    WHERE session_id = p_session_id AND removed_at IS NULL;
    IF active_count >= 10 THEN
      RAISE EXCEPTION 'A chat session can contain at most 10 active attachments'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE documents
  SET
    lifecycle_status = 'active',
    last_accessed_at = NOW(),
    expires_at = NOW() + INTERVAL '30 days',
    expired_at = NULL,
    purge_after = NULL,
    purge_claim_token = NULL,
    purge_claimed_at = NULL,
    last_cleanup_error = NULL,
    updated_at = NOW()
  WHERE id = p_document_id;

  UPDATE chat_session_documents
  SET removed_at = NULL, removed_by = NULL, added_at = NOW()
  WHERE session_id = p_session_id AND doc_id = p_document_id;

  RETURN QUERY
  SELECT d.id, d.lifecycle_status, d.expires_at FROM documents d WHERE d.id = p_document_id;
END;
$$;

CREATE OR REPLACE FUNCTION convert_session_document_to_library(
  p_document_id INT,
  p_session_id INT,
  p_user_id UUID
)
RETURNS TABLE (document_id INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target documents%ROWTYPE;
BEGIN
  SELECT * INTO target FROM documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR target.document_scope <> 'session'
    OR target.origin_session_id <> p_session_id
    OR target.user_id IS DISTINCT FROM p_user_id THEN
    RETURN;
  END IF;
  IF target.lifecycle_status = 'purging' THEN
    RAISE EXCEPTION 'Session attachment cleanup is in progress' USING ERRCODE = '55000';
  END IF;
  IF target.lifecycle_status = 'expired'
    AND (target.purge_after IS NULL OR target.purge_after <= NOW()) THEN
    RAISE EXCEPTION 'Session attachment recovery window has ended' USING ERRCODE = '55000';
  END IF;
  IF target.lifecycle_status = 'active'
    AND target.expires_at IS NOT NULL
    AND target.expires_at + INTERVAL '7 days' <= NOW() THEN
    RAISE EXCEPTION 'Session attachment recovery window has ended' USING ERRCODE = '55000';
  END IF;

  UPDATE documents
  SET
    document_scope = 'library',
    origin_session_id = NULL,
    lifecycle_status = 'active',
    last_accessed_at = NOW(),
    expires_at = NULL,
    expired_at = NULL,
    purge_after = NULL,
    purge_claim_token = NULL,
    purge_claimed_at = NULL,
    last_cleanup_error = NULL,
    is_public = FALSE,
    updated_at = NOW()
  WHERE id = p_document_id;

  RETURN QUERY SELECT p_document_id;
END;
$$;

REVOKE ALL ON FUNCTION touch_session_documents(INT[], TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION expire_due_session_documents(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION claim_session_documents_for_purge(INT, UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION finalize_session_document_purge(INT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION claim_storage_cleanup_items(INT, UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION restore_session_document(INT, INT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION convert_session_document_to_library(INT, INT, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION touch_session_documents(INT[], TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION expire_due_session_documents(INT) TO service_role;
GRANT EXECUTE ON FUNCTION claim_session_documents_for_purge(INT, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION finalize_session_document_purge(INT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION claim_storage_cleanup_items(INT, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION restore_session_document(INT, INT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION convert_session_document_to_library(INT, INT, UUID) TO service_role;
