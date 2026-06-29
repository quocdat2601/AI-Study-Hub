-- Link visibility is mutable; snapshots remain immutable.
ALTER TABLE chat_snapshot_links
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS token_value TEXT;

UPDATE chat_snapshot_links
SET is_enabled = FALSE
WHERE disabled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_snapshot_links_owner_enabled
  ON chat_snapshot_links (created_by, is_enabled, created_at DESC);
