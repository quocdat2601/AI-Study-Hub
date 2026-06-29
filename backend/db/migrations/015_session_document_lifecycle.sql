-- Session-only document lifecycle and soft attachment removal foundation.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS document_scope VARCHAR(20) NOT NULL DEFAULT 'library',
  ADD COLUMN IF NOT EXISTS origin_session_id INT REFERENCES chat_sessions(id),
  ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_scope_check'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_scope_check
      CHECK (document_scope IN ('library', 'session'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_lifecycle_status_check'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_lifecycle_status_check
      CHECK (lifecycle_status IN ('active', 'expired'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_session_origin_check'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_session_origin_check
      CHECK (document_scope = 'library' OR origin_session_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_session_private_check'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_session_private_check
      CHECK (document_scope = 'library' OR is_public = FALSE);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_scope_lifecycle
  ON documents (document_scope, lifecycle_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_session_expiry
  ON documents (expires_at)
  WHERE document_scope = 'session'
    AND lifecycle_status = 'active'
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_origin_session
  ON documents (origin_session_id)
  WHERE origin_session_id IS NOT NULL;

ALTER TABLE chat_session_documents
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_session_documents_active
  ON chat_session_documents (session_id, added_at)
  WHERE removed_at IS NULL;

DROP TRIGGER IF EXISTS trg_chat_session_document_limit ON chat_session_documents;
DROP FUNCTION IF EXISTS enforce_chat_session_document_limit();

CREATE OR REPLACE FUNCTION enforce_chat_session_document_limit()
RETURNS TRIGGER AS $$
DECLARE
  active_count INT;
BEGIN
  IF NEW.removed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.removed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize attachment activation within a session, including concurrent uploads.
  PERFORM pg_advisory_xact_lock(15401, NEW.session_id);

  SELECT COUNT(*)
  INTO active_count
  FROM chat_session_documents
  WHERE session_id = NEW.session_id
    AND removed_at IS NULL;

  IF active_count >= 10 THEN
    RAISE EXCEPTION 'A chat session can contain at most 10 active attachments'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chat_session_document_limit
BEFORE INSERT OR UPDATE OF removed_at ON chat_session_documents
FOR EACH ROW
EXECUTE FUNCTION enforce_chat_session_document_limit();
