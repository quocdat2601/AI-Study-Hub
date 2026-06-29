-- Store assistant response metadata for restored chat history.

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata
  ON chat_messages USING GIN (metadata);
