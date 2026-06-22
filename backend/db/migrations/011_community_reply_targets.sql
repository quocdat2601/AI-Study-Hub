-- Add flat reply-to-reply context for community threads.

ALTER TABLE community_replies
  ADD COLUMN IF NOT EXISTS parent_reply_id INT REFERENCES community_replies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_community_replies_parent_reply
  ON community_replies (parent_reply_id, created_at ASC);
