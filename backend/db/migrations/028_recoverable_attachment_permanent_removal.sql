-- Session-scoped permanent removal for recoverable temporary attachments.
-- This removes restore availability immediately and leaves physical storage
-- cleanup to the existing reference-aware lifecycle job.

CREATE OR REPLACE FUNCTION permanently_remove_recoverable_session_attachments(
  p_session_id INT,
  p_user_id UUID,
  p_document_id INT DEFAULT NULL
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
  ), recoverable AS (
    SELECT d.id
    FROM chat_session_documents AS csd
    JOIN owned_session AS os ON os.id = csd.session_id
    JOIN documents AS d ON d.id = csd.doc_id
    WHERE csd.removed_at IS NOT NULL
      AND csd.doc_id IS DISTINCT FROM os.primary_document_id
      AND (p_document_id IS NULL OR csd.doc_id = p_document_id)
      AND d.document_scope = 'session'
      AND d.origin_session_id = p_session_id
      AND d.user_id = p_user_id
      AND d.deleted_at IS NULL
      AND d.lifecycle_status IN ('active', 'expired')
      AND (
        d.lifecycle_status = 'active'
        OR d.purge_after IS NULL
        OR d.purge_after > NOW()
      )
    FOR UPDATE OF d
  ), updated_docs AS (
    UPDATE documents AS d
    SET lifecycle_status = 'expired',
      expired_at = COALESCE(d.expired_at, NOW()),
      purge_after = NOW(),
      purge_claim_token = NULL,
      purge_claimed_at = NULL,
      last_cleanup_error = NULL,
      updated_at = NOW()
    FROM recoverable AS r
    WHERE d.id = r.id
    RETURNING d.id AS removed_document_id
  )
  SELECT u.removed_document_id
  FROM updated_docs AS u;
END;
$$;

REVOKE ALL ON FUNCTION permanently_remove_recoverable_session_attachments(INT, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION permanently_remove_recoverable_session_attachments(INT, UUID, INT) TO service_role;
