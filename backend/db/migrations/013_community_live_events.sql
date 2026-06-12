-- Add a safe Realtime signal table for community feed and thread refreshes.

CREATE TABLE IF NOT EXISTS community_live_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  post_id INT NOT NULL,
  reply_id INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_live_events_type_check CHECK (
    event_type IN (
      'post_created',
      'post_updated',
      'post_deleted',
      'reply_created',
      'reply_updated',
      'reply_deleted',
      'post_vote_changed',
      'reply_vote_changed'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_community_live_events_post_created
  ON community_live_events (post_id, created_at DESC);

ALTER TABLE community_live_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON community_live_events TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_live_events'
      AND policyname = 'community_live_events_public_select'
  ) THEN
    CREATE POLICY community_live_events_public_select
      ON community_live_events
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION queue_community_live_event(
  p_event_type TEXT,
  p_post_id INT,
  p_reply_id INT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_post_id IS NULL OR p_event_type IS NULL OR BTRIM(p_event_type) = '' THEN
    RETURN;
  END IF;

  INSERT INTO community_live_events (event_type, post_id, reply_id)
  VALUES (p_event_type, p_post_id, p_reply_id);
END;
$$;

CREATE OR REPLACE FUNCTION handle_community_post_live_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM queue_community_live_event('post_created', NEW.id, NULL);
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM queue_community_live_event('post_deleted', OLD.id, NULL);
    RETURN NULL;
  END IF;

  IF NEW.title IS NOT DISTINCT FROM OLD.title
    AND NEW.body IS NOT DISTINCT FROM OLD.body
    AND NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id
    AND NEW.post_type IS NOT DISTINCT FROM OLD.post_type
    AND NEW.document_id IS NOT DISTINCT FROM OLD.document_id
    AND NEW.chat_session_id IS NOT DISTINCT FROM OLD.chat_session_id
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.solved_reply_id IS NOT DISTINCT FROM OLD.solved_reply_id THEN
    RETURN NULL;
  END IF;

  PERFORM queue_community_live_event('post_updated', NEW.id, NULL);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_post_live_event ON community_posts;

CREATE TRIGGER trg_community_post_live_event
AFTER INSERT OR UPDATE OR DELETE
ON community_posts
FOR EACH ROW
EXECUTE FUNCTION handle_community_post_live_event();

CREATE OR REPLACE FUNCTION handle_community_reply_live_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM queue_community_live_event('reply_created', NEW.post_id, NEW.id);
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM queue_community_live_event('reply_deleted', OLD.post_id, OLD.id);
    RETURN NULL;
  END IF;

  IF NEW.body IS NOT DISTINCT FROM OLD.body
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.is_accepted IS NOT DISTINCT FROM OLD.is_accepted
    AND NEW.parent_reply_id IS NOT DISTINCT FROM OLD.parent_reply_id THEN
    RETURN NULL;
  END IF;

  PERFORM queue_community_live_event('reply_updated', NEW.post_id, NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_reply_live_event ON community_replies;

CREATE TRIGGER trg_community_reply_live_event
AFTER INSERT OR UPDATE OR DELETE
ON community_replies
FOR EACH ROW
EXECUTE FUNCTION handle_community_reply_live_event();

CREATE OR REPLACE FUNCTION handle_community_vote_live_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_post_id INT;
  v_reply_id INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_post_id := OLD.post_id;
    v_reply_id := OLD.reply_id;
  ELSE
    v_post_id := NEW.post_id;
    v_reply_id := NEW.reply_id;
  END IF;

  IF v_post_id IS NULL AND v_reply_id IS NOT NULL THEN
    SELECT post_id
    INTO v_post_id
    FROM community_replies
    WHERE id = v_reply_id;
  END IF;

  IF v_post_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM queue_community_live_event(
    CASE
      WHEN v_reply_id IS NULL THEN 'post_vote_changed'
      ELSE 'reply_vote_changed'
    END,
    v_post_id,
    v_reply_id
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_vote_live_event ON community_votes;

CREATE TRIGGER trg_community_vote_live_event
AFTER INSERT OR DELETE
ON community_votes
FOR EACH ROW
EXECUTE FUNCTION handle_community_vote_live_event();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'community_live_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.community_live_events';
  END IF;
END $$;
