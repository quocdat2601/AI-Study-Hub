-- Restore explicit document ownership for multi-document chat sessions.

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS primary_document_id INT
    REFERENCES documents(id) ON DELETE CASCADE;

-- The original doc_id was copied into chat_session_documents by migration 004.
-- Backfill only a sole attachment or a uniquely earliest historical link. Sessions
-- with tied/missing earliest timestamps remain NULL for explicit reconciliation.
WITH ranked_links AS (
  SELECT
    session_id,
    doc_id,
    added_at,
    COUNT(*) OVER (PARTITION BY session_id) AS attachment_count,
    DENSE_RANK() OVER (
      PARTITION BY session_id
      ORDER BY added_at ASC NULLS LAST
    ) AS attachment_rank,
    COUNT(*) OVER (PARTITION BY session_id, added_at) AS timestamp_tie_count
  FROM chat_session_documents
), safe_roots AS (
  SELECT session_id, doc_id
  FROM ranked_links
  WHERE attachment_count = 1
     OR (
       attachment_rank = 1
       AND added_at IS NOT NULL
       AND timestamp_tie_count = 1
     )
)
UPDATE chat_sessions AS sessions
SET primary_document_id = safe_roots.doc_id
FROM safe_roots
WHERE sessions.id = safe_roots.session_id
  AND sessions.primary_document_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_owner_primary_activity
  ON chat_sessions(user_id, primary_document_id, last_activity_at DESC)
  WHERE deleted_at IS NULL;
