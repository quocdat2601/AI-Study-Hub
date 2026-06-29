-- Schema integrity fixes: FK, NOT NULL, check constraints, and partial unique indexes.
-- Safe to run idempotently. Does NOT drop community_posts.subject_id or users.major
-- (both still actively used by code).

BEGIN;

-- 1. FK on bookmarks.user_id (was nullable with no referential constraint)
ALTER TABLE public.bookmarks
  ADD CONSTRAINT bookmarks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 2. NOT NULL on bookmarks.user_id (a bookmark without an owner is meaningless)
--    Pre-condition verified: SELECT COUNT(*) FROM bookmarks WHERE user_id IS NULL = 0
ALTER TABLE public.bookmarks
  ALTER COLUMN user_id SET NOT NULL;

-- 3. Polymorphic target check on community_votes (exactly one of post/reply must be set)
ALTER TABLE public.community_votes
  ADD CONSTRAINT community_votes_target_check
  CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL) OR
    (post_id IS NULL AND reply_id IS NOT NULL)
  );

-- 4. Polymorphic target check on community_reports
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_target_check
  CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL) OR
    (post_id IS NULL AND reply_id IS NOT NULL)
  );

-- 5. Partial unique indexes on community_votes to prevent duplicate votes.
--    A plain UNIQUE(user_id, post_id) would fail because post_id can be NULL.
CREATE UNIQUE INDEX community_votes_user_post_unique
  ON public.community_votes(user_id, post_id)
  WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX community_votes_user_reply_unique
  ON public.community_votes(user_id, reply_id)
  WHERE reply_id IS NOT NULL;

COMMIT;
