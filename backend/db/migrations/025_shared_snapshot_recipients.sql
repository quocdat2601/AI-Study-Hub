-- Recipient history is a lightweight pointer to an immutable snapshot.
CREATE TABLE IF NOT EXISTS shared_snapshot_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES chat_snapshots(id) ON DELETE CASCADE,
  link_id UUID NOT NULL REFERENCES chat_snapshot_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_snapshot_recipients_user_activity
  ON shared_snapshot_recipients (user_id, last_opened_at DESC);
