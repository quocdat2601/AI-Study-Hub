-- Text chunks used by the temporary RAG workspace.

CREATE TABLE IF NOT EXISTS document_chunks (
  id SERIAL PRIMARY KEY,
  doc_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  token_estimate INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doc_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id
  ON document_chunks(doc_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_document_chunks_content_search
  ON document_chunks USING GIN (to_tsvector('simple', content));

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_chunks_select_access ON document_chunks;
CREATE POLICY document_chunks_select_access ON document_chunks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM documents
      WHERE documents.id = document_chunks.doc_id
        AND (
          documents.user_id = auth.uid()
          OR documents.is_public = TRUE
          OR EXISTS (
            SELECT 1
            FROM doc_shares
            WHERE doc_shares.doc_id = documents.id
              AND doc_shares.shared_to = auth.uid()
              AND doc_shares.status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS document_chunks_write_owner ON document_chunks;
CREATE POLICY document_chunks_write_owner ON document_chunks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM documents
      WHERE documents.id = document_chunks.doc_id
        AND documents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM documents
      WHERE documents.id = document_chunks.doc_id
        AND documents.user_id = auth.uid()
    )
  );
