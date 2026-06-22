-- Community post subjects: optional multi-subject tagging and discussion posts.

ALTER TABLE community_posts
  DROP CONSTRAINT IF EXISTS community_posts_post_type_check;

ALTER TABLE community_posts
  ADD CONSTRAINT community_posts_post_type_check
  CHECK (post_type IN ('discussion', 'question', 'document_share', 'ai_study_log'));

ALTER TABLE community_posts
  DROP CONSTRAINT IF EXISTS community_posts_attachment_shape;

ALTER TABLE community_posts
  ADD CONSTRAINT community_posts_attachment_shape CHECK (
    (post_type IN ('discussion', 'question') AND document_id IS NULL AND chat_session_id IS NULL)
    OR (post_type = 'document_share' AND document_id IS NOT NULL AND chat_session_id IS NULL)
    OR (post_type = 'ai_study_log' AND document_id IS NULL AND chat_session_id IS NOT NULL)
  );

CREATE TABLE IF NOT EXISTS community_post_subjects (
  post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_community_post_subjects_subject
  ON community_post_subjects (subject_id, post_id);

INSERT INTO community_post_subjects (post_id, subject_id)
SELECT id, subject_id
FROM community_posts
WHERE subject_id IS NOT NULL
ON CONFLICT (post_id, subject_id) DO NOTHING;
