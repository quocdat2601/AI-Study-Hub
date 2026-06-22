-- Multi-document vector retrieval and session-level AI usage attribution.

CREATE OR REPLACE FUNCTION match_document_chunks_multi(
  p_doc_ids INT[],
  p_query_embedding extensions.vector(768),
  p_match_count INT DEFAULT 4
)
RETURNS TABLE (
  id INT,
  doc_id INT,
  chunk_index INT,
  content TEXT,
  token_estimate INT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  embedding_model TEXT,
  embedding_status VARCHAR(20),
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    dc.id,
    dc.doc_id,
    dc.chunk_index,
    dc.content,
    dc.token_estimate,
    dc.metadata,
    dc.created_at,
    dc.updated_at,
    dc.embedding_model,
    dc.embedding_status,
    1 - (dc.embedding <=> p_query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.doc_id = ANY(COALESCE(p_doc_ids, ARRAY[]::INT[]))
    AND dc.embedding IS NOT NULL
    AND dc.embedding_status = 'ready'
  ORDER BY dc.embedding <=> p_query_embedding
  LIMIT LEAST(GREATEST(p_match_count, 1), 40);
$$;

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS session_id INT REFERENCES chat_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_session_created
  ON ai_usage_logs(session_id, created_at DESC)
  WHERE session_id IS NOT NULL;
