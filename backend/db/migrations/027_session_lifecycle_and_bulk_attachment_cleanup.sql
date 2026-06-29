-- Correct session lifecycle ambiguity from migration 026 and add one
-- session-scoped temporary attachment bulk-removal RPC.

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
  ), expired_docs AS (
    UPDATE documents AS d
    SET lifecycle_status = 'expired',
      expired_at = NOW(),
      purge_after = NOW() + INTERVAL '7 days',
      purge_claim_token = NULL,
      purge_claimed_at = NULL,
      last_cleanup_error = NULL,
      updated_at = NOW()
    FROM candidates AS c
    WHERE d.id = c.id
    RETURNING d.id AS document_id, d.expired_at AS document_expired_at, d.purge_after AS document_purge_after
  ), detached_links AS (
    UPDATE chat_session_documents AS csd
    SET removed_at = NOW(),
      removed_by = NULL
    FROM expired_docs AS e
    WHERE csd.doc_id = e.document_id
      AND csd.removed_at IS NULL
    RETURNING csd.doc_id
  )
  SELECT e.document_id, e.document_expired_at, e.document_purge_after
  FROM expired_docs AS e;
END;
$$;

CREATE OR REPLACE FUNCTION remove_temporary_session_attachments(
  p_session_id INT,
  p_user_id UUID
)
RETURNS TABLE (document_id INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH owned_session AS (
    SELECT cs.id, cs.primary_document_id
    FROM chat_sessions AS cs
    WHERE cs.id = p_session_id
      AND cs.user_id = p_user_id
      AND cs.deleted_at IS NULL
  ), removable AS (
    SELECT csd.session_id, csd.doc_id
    FROM chat_session_documents AS csd
    JOIN owned_session AS os ON os.id = csd.session_id
    JOIN documents AS d ON d.id = csd.doc_id
    WHERE csd.removed_at IS NULL
      AND csd.doc_id IS DISTINCT FROM os.primary_document_id
      AND d.document_scope = 'session'
      AND d.lifecycle_status = 'active'
      AND d.deleted_at IS NULL
      AND (d.expires_at IS NULL OR d.expires_at > NOW())
  ), removed AS (
    UPDATE chat_session_documents AS csd
    SET removed_at = NOW(),
      removed_by = p_user_id
    FROM removable AS r
    WHERE csd.session_id = r.session_id
      AND csd.doc_id = r.doc_id
      AND csd.removed_at IS NULL
    RETURNING csd.doc_id AS removed_document_id
  )
  SELECT r.removed_document_id
  FROM removed AS r;
END;
$$;

REVOKE ALL ON FUNCTION expire_due_session_documents(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION remove_temporary_session_attachments(INT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_due_session_documents(INT) TO service_role;
GRANT EXECUTE ON FUNCTION remove_temporary_session_attachments(INT, UUID) TO service_role;
