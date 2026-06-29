-- Per-user notebook notes anchored to document selections.

CREATE TABLE IF NOT EXISTS document_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id          INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  view_mode       VARCHAR(10) NOT NULL CHECK (view_mode IN ('pdf', 'text')),
  selected_text   TEXT NOT NULL,
  content         TEXT NOT NULL,
  page_number     INT,
  paragraph_index INT,
  anchor          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_notes_doc_user_created
  ON document_notes(doc_id, user_id, created_at DESC);

ALTER TABLE document_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_notes_select_own ON document_notes;
CREATE POLICY document_notes_select_own ON document_notes
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM documents
      WHERE documents.id = document_notes.doc_id
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

DROP POLICY IF EXISTS document_notes_insert_own ON document_notes;
CREATE POLICY document_notes_insert_own ON document_notes
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM documents
      WHERE documents.id = document_notes.doc_id
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

DROP POLICY IF EXISTS document_notes_delete_own ON document_notes;
CREATE POLICY document_notes_delete_own ON document_notes
  FOR DELETE
  USING (user_id = auth.uid());
