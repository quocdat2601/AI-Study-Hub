-- Create database views for optimized community posts and user stats queries.

CREATE OR REPLACE VIEW community_posts_feed_view AS
SELECT 
  cp.id AS post_id,
  cp.user_id,
  cp.subject_id,
  cp.post_type,
  cp.title,
  cp.body,
  cp.document_id,
  cp.chat_session_id,
  cp.status,
  cp.solved_reply_id,
  cp.created_at,
  cp.updated_at,
  cp.view_count,
  COALESCE(v.vote_count, 0) AS vote_count,
  COALESCE(r.reply_count, 0) AS reply_count,
  COALESCE(
    (SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'code', s.code))
     FROM community_post_subjects cps
     JOIN subjects s ON s.id = cps.subject_id
     WHERE cps.post_id = cp.id),
    '[]'::json
  ) AS subjects,
  u.email AS author_email,
  u.display_name AS author_display_name,
  u.role AS author_role
FROM community_posts cp
LEFT JOIN users u ON u.id = cp.user_id
LEFT JOIN (
  SELECT post_id, COALESCE(SUM(value), 0) AS vote_count
  FROM community_votes
  WHERE reply_id IS NULL
  GROUP BY post_id
) v ON v.post_id = cp.id
LEFT JOIN (
  SELECT post_id, COUNT(*) AS reply_count
  FROM community_replies
  WHERE status = 'active'
  GROUP BY post_id
) r ON r.post_id = cp.id;


CREATE OR REPLACE VIEW community_user_stats AS
SELECT 
  u.id AS id,
  u.email,
  u.role,
  u.status,
  u.created_at,
  u.display_name,
  COALESCE(p.post_count, 0) AS post_count,
  COALESCE(r.reply_count, 0) AS reply_count,
  (COALESCE(pv.vote_sum, 0) + COALESCE(rv.vote_sum, 0) + COALESCE(ar.accepted_count, 0) * 3) AS utility_points
FROM users u
LEFT JOIN (
  SELECT user_id, COUNT(*) AS post_count
  FROM community_posts
  WHERE status = 'active'
  GROUP BY user_id
) p ON p.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS reply_count
  FROM community_replies
  WHERE status = 'active'
  GROUP BY user_id
) r ON r.user_id = u.id
LEFT JOIN (
  SELECT cp.user_id, COALESCE(SUM(cv.value), 0) AS vote_sum
  FROM community_posts cp
  JOIN community_votes cv ON cv.post_id = cp.id
  WHERE cp.status = 'active'
  GROUP BY cp.user_id
) pv ON pv.user_id = u.id
LEFT JOIN (
  SELECT cr.user_id, COALESCE(SUM(cv.value), 0) AS vote_sum
  FROM community_replies cr
  JOIN community_votes cv ON cv.reply_id = cr.id
  WHERE cr.status = 'active'
  GROUP BY cr.user_id
) rv ON rv.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS accepted_count
  FROM community_replies
  WHERE status = 'active' AND is_accepted = TRUE
  GROUP BY user_id
) ar ON ar.user_id = u.id;

CREATE OR REPLACE VIEW community_subject_post_counts AS
SELECT 
  s.id AS subject_id,
  COUNT(cp.id) AS post_count
FROM subjects s
LEFT JOIN community_post_subjects cps ON cps.subject_id = s.id
LEFT JOIN community_posts cp ON cp.id = cps.post_id AND cp.status = 'active'
GROUP BY s.id;
