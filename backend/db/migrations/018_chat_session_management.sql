-- Soft deletion for user-managed chat sessions.

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_owner_active_activity
  ON chat_sessions(user_id, last_activity_at DESC)
  WHERE deleted_at IS NULL;
