-- Add community thread view counting with session-style dedupe.

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_posts_view_count_nonnegative'
  ) THEN
    ALTER TABLE community_posts
      ADD CONSTRAINT community_posts_view_count_nonnegative
      CHECK (view_count >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_community_posts_view_count_created
  ON community_posts (view_count DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS community_post_views (
  post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  viewer_key TEXT NOT NULL,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, viewer_key)
);

CREATE INDEX IF NOT EXISTS idx_community_post_views_recent
  ON community_post_views (post_id, last_viewed_at DESC);

CREATE OR REPLACE FUNCTION track_community_post_view(
  p_post_id INT,
  p_viewer_key TEXT,
  p_window_minutes INT DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_viewed_at TIMESTAMPTZ;
  v_should_increment BOOLEAN := FALSE;
  v_window_minutes INT := GREATEST(COALESCE(p_window_minutes, 30), 1);
BEGIN
  IF p_post_id IS NULL OR p_viewer_key IS NULL OR BTRIM(p_viewer_key) = '' THEN
    RETURN FALSE;
  END IF;

  SELECT last_viewed_at
  INTO v_last_viewed_at
  FROM community_post_views
  WHERE post_id = p_post_id
    AND viewer_key = p_viewer_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO community_post_views (post_id, viewer_key, last_viewed_at)
    VALUES (p_post_id, p_viewer_key, NOW());
    v_should_increment := TRUE;
  ELSE
    v_should_increment := v_last_viewed_at <= NOW() - make_interval(mins => v_window_minutes);

    UPDATE community_post_views
    SET last_viewed_at = NOW()
    WHERE post_id = p_post_id
      AND viewer_key = p_viewer_key;
  END IF;

  IF v_should_increment THEN
    UPDATE community_posts
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_post_id;
  END IF;

  RETURN v_should_increment;
END;
$$;
