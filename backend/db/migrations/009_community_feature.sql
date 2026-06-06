-- Community feature schema: public feed, replies, votes, and moderation reports.

CREATE TABLE IF NOT EXISTS community_posts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INT REFERENCES subjects(id) ON DELETE SET NULL,
  post_type VARCHAR(20) NOT NULL
    CHECK (post_type IN ('question', 'document_share', 'ai_study_log')),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  document_id INT REFERENCES documents(id) ON DELETE CASCADE,
  chat_session_id INT REFERENCES chat_sessions(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'removed')),
  solved_reply_id INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT community_posts_attachment_shape CHECK (
    (post_type = 'question' AND document_id IS NULL AND chat_session_id IS NULL)
    OR (post_type = 'document_share' AND document_id IS NOT NULL AND chat_session_id IS NULL)
    OR (post_type = 'ai_study_log' AND document_id IS NULL AND chat_session_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS community_replies (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'removed')),
  is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'community_posts_solved_reply_fkey'
      AND table_name = 'community_posts'
  ) THEN
    ALTER TABLE community_posts
      ADD CONSTRAINT community_posts_solved_reply_fkey
      FOREIGN KEY (solved_reply_id)
      REFERENCES community_replies(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_votes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INT REFERENCES community_posts(id) ON DELETE CASCADE,
  reply_id INT REFERENCES community_replies(id) ON DELETE CASCADE,
  value INT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT community_votes_target_xor CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL)
    OR (post_id IS NULL AND reply_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS community_reports (
  id SERIAL PRIMARY KEY,
  post_id INT REFERENCES community_posts(id) ON DELETE CASCADE,
  reply_id INT REFERENCES community_replies(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT community_reports_target_xor CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL)
    OR (post_id IS NULL AND reply_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_community_posts_feed
  ON community_posts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_subject
  ON community_posts (subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_type
  ON community_posts (post_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_posts_active_chat_session
  ON community_posts (chat_session_id)
  WHERE chat_session_id IS NOT NULL
    AND post_type = 'ai_study_log'
    AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_replies_one_accepted
  ON community_replies (post_id)
  WHERE is_accepted = TRUE
    AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_community_replies_post
  ON community_replies (post_id, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_votes_unique_post_target
  ON community_votes (user_id, post_id)
  WHERE post_id IS NOT NULL
    AND reply_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_votes_unique_reply_target
  ON community_votes (user_id, reply_id)
  WHERE reply_id IS NOT NULL
    AND post_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_community_reports_status_created
  ON community_reports (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_reports_unique_open_post
  ON community_reports (reported_by, post_id)
  WHERE post_id IS NOT NULL
    AND reply_id IS NULL
    AND status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_reports_unique_open_reply
  ON community_reports (reported_by, reply_id)
  WHERE reply_id IS NOT NULL
    AND post_id IS NULL
    AND status = 'open';
