-- Semantic retrieval support for document chunks.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'ready', 'failed')),
  ADD COLUMN IF NOT EXISTS embedding_error TEXT;

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON document_chunks
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

CREATE OR REPLACE FUNCTION match_document_chunks(
  p_doc_id INT,
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
  WHERE dc.doc_id = p_doc_id
    AND dc.embedding IS NOT NULL
    AND dc.embedding_status = 'ready'
  ORDER BY dc.embedding <=> p_query_embedding
  LIMIT LEAST(GREATEST(p_match_count, 1), 20);
$$;
