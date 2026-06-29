-- Drag/drop session attachments: idempotent uploads, 20-document sessions,
-- and retryable processing claims.

ALTER TABLE chat_session_documents
  ADD COLUMN IF NOT EXISTS upload_request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_session_documents_upload_request
  ON chat_session_documents (session_id, upload_request_id)
  WHERE upload_request_id IS NOT NULL;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS ai_processing_claim_token UUID,
  ADD COLUMN IF NOT EXISTS ai_processing_claimed_at TIMESTAMPTZ;

DROP TRIGGER IF EXISTS trg_chat_session_document_limit ON chat_session_documents;
CREATE OR REPLACE FUNCTION enforce_chat_session_document_limit()
RETURNS TRIGGER AS $$
DECLARE
  active_count INT;
BEGIN
  IF NEW.removed_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.removed_at IS NULL THEN RETURN NEW; END IF;

  PERFORM pg_advisory_xact_lock(15401, NEW.session_id);
  SELECT COUNT(*) INTO active_count
  FROM chat_session_documents
  WHERE session_id = NEW.session_id AND removed_at IS NULL;

  IF active_count >= 20 THEN
    RAISE EXCEPTION 'A chat session can contain at most 20 active documents (1 primary document and 19 attachments)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chat_session_document_limit
BEFORE INSERT OR UPDATE OF removed_at ON chat_session_documents
FOR EACH ROW EXECUTE FUNCTION enforce_chat_session_document_limit();

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
    OR target.user_id IS DISTINCT FROM p_user_id THEN RETURN; END IF;
  IF target.lifecycle_status = 'purging' THEN
    RAISE EXCEPTION 'Session attachment cleanup is in progress' USING ERRCODE = '55000';
  END IF;
  IF target.lifecycle_status = 'expired' AND (target.purge_after IS NULL OR target.purge_after <= NOW()) THEN
    RAISE EXCEPTION 'Session attachment recovery window has ended' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO link FROM chat_session_documents
  WHERE session_id = p_session_id AND doc_id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF link.removed_at IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(15401, p_session_id);
    SELECT COUNT(*) INTO active_count FROM chat_session_documents
    WHERE session_id = p_session_id AND removed_at IS NULL;
    IF active_count >= 20 THEN
      RAISE EXCEPTION 'A chat session can contain at most 20 active documents (1 primary document and 19 attachments)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE documents SET lifecycle_status = 'active', last_accessed_at = NOW(),
    expires_at = NOW() + INTERVAL '30 days', expired_at = NULL, purge_after = NULL,
    purge_claim_token = NULL, purge_claimed_at = NULL, last_cleanup_error = NULL,
    updated_at = NOW() WHERE id = p_document_id;
  UPDATE chat_session_documents SET removed_at = NULL, removed_by = NULL, added_at = NOW()
  WHERE session_id = p_session_id AND doc_id = p_document_id;
  RETURN QUERY SELECT d.id, d.lifecycle_status, d.expires_at FROM documents d WHERE d.id = p_document_id;
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
  ), expired AS (
    UPDATE documents d SET lifecycle_status = 'expired', expired_at = NOW(),
      purge_after = NOW() + INTERVAL '7 days', purge_claim_token = NULL,
      purge_claimed_at = NULL, last_cleanup_error = NULL, updated_at = NOW()
    FROM candidates c WHERE d.id = c.id
    RETURNING d.id, d.expired_at, d.purge_after
  ), detached AS (
    UPDATE chat_session_documents csd SET removed_at = NOW(), removed_by = NULL
    FROM expired e WHERE csd.doc_id = e.id AND csd.removed_at IS NULL
  )
  SELECT id, expired_at, purge_after FROM expired;
END;
$$;

CREATE OR REPLACE FUNCTION claim_session_document_processing(
  p_document_id INT,
  p_session_id INT,
  p_user_id UUID,
  p_claim_token UUID,
  p_stale_seconds INT DEFAULT 900
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE claimed_id INT;
BEGIN
  UPDATE documents d SET ai_processing_claim_token = p_claim_token,
    ai_processing_claimed_at = NOW(), updated_at = NOW()
  WHERE d.id = p_document_id AND d.document_scope = 'session'
    AND d.origin_session_id = p_session_id AND d.user_id = p_user_id
    AND d.lifecycle_status = 'active' AND d.deleted_at IS NULL
    AND (d.expires_at IS NULL OR d.expires_at > NOW())
    AND EXISTS (SELECT 1 FROM chat_session_documents csd
      WHERE csd.session_id = p_session_id AND csd.doc_id = d.id AND csd.removed_at IS NULL)
    AND (d.ai_processing_claim_token IS NULL OR d.ai_processing_claimed_at < NOW() - make_interval(secs => GREATEST(p_stale_seconds, 60)))
  RETURNING d.id INTO claimed_id;
  RETURN claimed_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION release_session_document_processing(
  p_document_id INT,
  p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE released_id INT;
BEGIN
  UPDATE documents SET ai_processing_claim_token = NULL, ai_processing_claimed_at = NULL, updated_at = NOW()
  WHERE id = p_document_id AND ai_processing_claim_token = p_claim_token
  RETURNING id INTO released_id;
  RETURN released_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION claim_session_document_processing(INT, INT, UUID, UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION release_session_document_processing(INT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_session_document_processing(INT, INT, UUID, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION release_session_document_processing(INT, UUID) TO service_role;
