-- Chat sharing primitives and caller-scoped RLS hardening for AI-safe queries.

CREATE TABLE IF NOT EXISTS chat_session_shares (
  session_id INT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  shared_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(10) NOT NULL DEFAULT 'read'
    CHECK (permission IN ('read')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (session_id, shared_to)
);

CREATE TABLE IF NOT EXISTS chat_public_links (
  session_id INT PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

ALTER TABLE chat_session_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_public_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_select_access ON documents;
CREATE POLICY documents_select_access ON documents
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_public = TRUE
    OR EXISTS (
      SELECT 1
      FROM doc_shares
      WHERE doc_shares.doc_id = documents.id
        AND doc_shares.shared_to = auth.uid()
        AND doc_shares.status = 'active'
    )
  );

DROP POLICY IF EXISTS documents_insert_owner ON documents;
CREATE POLICY documents_insert_owner ON documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS documents_update_owner ON documents;
CREATE POLICY documents_update_owner ON documents
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS documents_delete_owner ON documents;
CREATE POLICY documents_delete_owner ON documents
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS chat_sessions_select_access ON chat_sessions;
CREATE POLICY chat_sessions_select_access ON chat_sessions
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM chat_session_shares
      WHERE chat_session_shares.session_id = chat_sessions.id
        AND chat_session_shares.shared_to = auth.uid()
        AND chat_session_shares.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS chat_sessions_insert_owner ON chat_sessions;
CREATE POLICY chat_sessions_insert_owner ON chat_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS chat_sessions_update_owner ON chat_sessions;
CREATE POLICY chat_sessions_update_owner ON chat_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS chat_sessions_delete_owner ON chat_sessions;
CREATE POLICY chat_sessions_delete_owner ON chat_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS doc_shares_select_access ON doc_shares;
CREATE POLICY doc_shares_select_access ON doc_shares
  FOR SELECT
  USING (
    shared_by = auth.uid()
    OR shared_to = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM documents
      WHERE documents.id = doc_shares.doc_id
        AND documents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS doc_shares_write_owner ON doc_shares;
CREATE POLICY doc_shares_write_owner ON doc_shares
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM documents
      WHERE documents.id = doc_shares.doc_id
        AND documents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM documents
      WHERE documents.id = doc_shares.doc_id
        AND documents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_session_documents_select_access ON chat_session_documents;
CREATE POLICY chat_session_documents_select_access ON chat_session_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM chat_sessions
      WHERE chat_sessions.id = chat_session_documents.session_id
        AND (
          chat_sessions.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM chat_session_shares
            WHERE chat_session_shares.session_id = chat_sessions.id
              AND chat_session_shares.shared_to = auth.uid()
              AND chat_session_shares.revoked_at IS NULL
          )
        )
    )
  );

DROP POLICY IF EXISTS chat_session_documents_write_owner ON chat_session_documents;
CREATE POLICY chat_session_documents_write_owner ON chat_session_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM chat_sessions
      WHERE chat_sessions.id = chat_session_documents.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM chat_sessions
      WHERE chat_sessions.id = chat_session_documents.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_session_shares_select_access ON chat_session_shares;
CREATE POLICY chat_session_shares_select_access ON chat_session_shares
  FOR SELECT
  USING (
    shared_to = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM chat_sessions
      WHERE chat_sessions.id = chat_session_shares.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_session_shares_write_owner ON chat_session_shares;
CREATE POLICY chat_session_shares_write_owner ON chat_session_shares
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM chat_sessions
      WHERE chat_sessions.id = chat_session_shares.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM chat_sessions
      WHERE chat_sessions.id = chat_session_shares.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_public_links_select_owner ON chat_public_links;
CREATE POLICY chat_public_links_select_owner ON chat_public_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM chat_sessions
      WHERE chat_sessions.id = chat_public_links.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_public_links_write_owner ON chat_public_links;
CREATE POLICY chat_public_links_write_owner ON chat_public_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM chat_sessions
      WHERE chat_sessions.id = chat_public_links.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM chat_sessions
      WHERE chat_sessions.id = chat_public_links.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  );

ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions FORCE ROW LEVEL SECURITY;
