-- Per-user generated study materials (flashcards, quiz, mindmap) anchored to documents.

CREATE TABLE IF NOT EXISTS workspace_study_materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id          INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_type   VARCHAR(20) NOT NULL CHECK (material_type IN ('flashcard', 'quiz', 'mindmap')),
  title           VARCHAR(255) NOT NULL,
  content         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_study_materials_doc_user
  ON workspace_study_materials(doc_id, user_id, material_type);

ALTER TABLE workspace_study_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_study_materials_select_own ON workspace_study_materials;
CREATE POLICY workspace_study_materials_select_own ON workspace_study_materials
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM documents
      WHERE documents.id = workspace_study_materials.doc_id
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

DROP POLICY IF EXISTS workspace_study_materials_insert_own ON workspace_study_materials;
CREATE POLICY workspace_study_materials_insert_own ON workspace_study_materials
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM documents
      WHERE documents.id = workspace_study_materials.doc_id
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

DROP POLICY IF EXISTS workspace_study_materials_delete_own ON workspace_study_materials;
CREATE POLICY workspace_study_materials_delete_own ON workspace_study_materials
  FOR DELETE
  USING (user_id = auth.uid());
