-- Multi-document chat sessions and stored extraction text.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'ready', 'empty', 'failed')),
  ADD COLUMN IF NOT EXISTS extraction_error TEXT,
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS title VARCHAR(120) NOT NULL DEFAULT 'New chat',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS chat_session_documents (
  session_id INT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  doc_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, doc_id)
);

ALTER TABLE chat_session_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'chat_sessions'
      AND column_name = 'doc_id'
  ) THEN
    INSERT INTO chat_session_documents (session_id, doc_id)
    SELECT id, doc_id
    FROM chat_sessions
    WHERE doc_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

ALTER TABLE chat_sessions
  DROP CONSTRAINT IF EXISTS chat_sessions_user_id_doc_id_key;

ALTER TABLE chat_sessions
  DROP COLUMN IF EXISTS doc_id;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_activity
  ON chat_sessions(user_id, last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_order
  ON chat_messages(session_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_chat_session_documents_doc
  ON chat_session_documents(doc_id);

CREATE OR REPLACE FUNCTION enforce_chat_session_document_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM chat_session_documents
    WHERE session_id = NEW.session_id
  ) >= 5 THEN
    RAISE EXCEPTION 'A chat session can contain at most 5 documents';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_session_document_limit ON chat_session_documents;

CREATE TRIGGER trg_chat_session_document_limit
BEFORE INSERT ON chat_session_documents
FOR EACH ROW
EXECUTE FUNCTION enforce_chat_session_document_limit();
