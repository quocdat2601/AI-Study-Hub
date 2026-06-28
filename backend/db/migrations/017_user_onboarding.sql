-- Onboarding / Interest selection + gợi ý tài liệu HYBRID (môn học + tag) — ĐH FPT.
-- Ngành (majors) = lookup tiếng Việt; tag tiếng Anh; môn (subjects) gắn ngành qua major_id.
-- File này idempotent + tự dọn dữ liệu thử nghiệm cũ → chạy được trên DB mới lẫn DB đã lỡ seed.

-- ─── Ngành (lookup, 5 ngành FPT) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS majors (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20)  NOT NULL UNIQUE
);

-- ─── Preference scalar của user (1-1). users.id là UUID (Supabase Auth) ─────
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  major_id     INT REFERENCES majors(id) ON DELETE SET NULL,
  goal         VARCHAR(20) CHECK (goal IN ('exam', 'project', 'self_study')),
  onboarded_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Topic multi-select: nối user ↔ tags ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_topic_selections (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id     INT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_user_topic_selections_tag
  ON user_topic_selections (tag_id);

-- ─── Môn học user quan tâm (subject — tín hiệu mạnh của gợi ý hybrid) ────────
CREATE TABLE IF NOT EXISTS user_subject_selections (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INT  NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subject_selections_subject
  ON user_subject_selections (subject_id);

-- ─── Gợi ý topic theo ngành ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS major_suggested_tags (
  major_id INT NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
  tag_id   INT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (major_id, tag_id)
);

-- ─── Seed/đồng bộ danh sách ngành ───────────────────────────────────────────
DELETE FROM major_suggested_tags;
DELETE FROM majors WHERE code NOT IN ('CNTT', 'QTKD', 'TRUYENTHONG', 'NGONNGU', 'LUAT');

INSERT INTO majors (name, code) VALUES
  ('Công nghệ thông tin',    'CNTT'),
  ('Quản trị kinh doanh',    'QTKD'),
  ('Công nghệ truyền thông', 'TRUYENTHONG'),
  ('Ngôn ngữ',               'NGONNGU'),
  ('Luật',                   'LUAT')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- ─── Gắn môn học vào ngành (để lọc môn theo ngành khi onboarding) ────────────
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS major_id INT REFERENCES majors(id) ON DELETE SET NULL;

-- Demo CNTT: gán toàn bộ môn hiện có vào ngành CNTT (các ngành khác bổ sung sau)
UPDATE subjects
SET major_id = (SELECT id FROM majors WHERE code = 'CNTT')
WHERE major_id IS NULL;

-- ─── Seed tag chủ đề (tiếng Anh, lowercase — khớp pipeline parseNames) ───────
INSERT INTO tags (name) VALUES
  -- CNTT
  ('software engineering'), ('artificial intelligence'), ('data science'), ('information security'),
  ('web development'), ('mobile development'), ('database'), ('data structures'), ('algorithms'),
  ('machine learning'), ('computer networks'),
  -- Quản trị kinh doanh
  ('digital marketing'), ('international business'), ('finance'), ('accounting'),
  ('hotel management'), ('logistics'), ('management'), ('entrepreneurship'),
  -- Công nghệ truyền thông
  ('multimedia communication'), ('public relations'), ('graphic design'), ('content creation'),
  ('advertising'), ('journalism'),
  -- Ngôn ngữ
  ('english language'), ('japanese language'), ('korean language'), ('chinese language'),
  ('translation'), ('linguistics'),
  -- Luật
  ('economic law'), ('international law'), ('civil law'), ('criminal law'),
  ('business law'), ('constitutional law')
ON CONFLICT (name) DO NOTHING;

-- ─── Map ngành → chủ đề gợi ý ───────────────────────────────────────────────
INSERT INTO major_suggested_tags (major_id, tag_id)
SELECT m.id, t.id
FROM majors m
JOIN tags t ON t.name = ANY (
  CASE m.code
    WHEN 'CNTT' THEN ARRAY[
      'software engineering','artificial intelligence','data science','information security',
      'web development','mobile development','database','data structures','algorithms',
      'machine learning','computer networks']
    WHEN 'QTKD' THEN ARRAY[
      'digital marketing','international business','finance','accounting','hotel management',
      'logistics','management','entrepreneurship']
    WHEN 'TRUYENTHONG' THEN ARRAY[
      'multimedia communication','public relations','graphic design','content creation',
      'advertising','journalism']
    WHEN 'NGONNGU' THEN ARRAY[
      'english language','japanese language','korean language','chinese language',
      'translation','linguistics']
    WHEN 'LUAT' THEN ARRAY[
      'economic law','international law','civil law','criminal law','business law','constitutional law']
    ELSE ARRAY[]::TEXT[]
  END
)
ON CONFLICT (major_id, tag_id) DO NOTHING;

-- ─── Dọn dữ liệu thử nghiệm cũ ──────────────────────────────────────────────
-- Tag generic của bản nháp đầu (không thuộc FPT) — chỉ xóa khi chưa ai dùng tới
DELETE FROM tags t
WHERE t.name IN (
  'cybersecurity','networking','operating systems','microeconomics','macroeconomics',
  'marketing','anatomy','physiology','pharmacology','pathology','mechanics','thermodynamics',
  'electronics','materials science'
)
AND NOT EXISTS (SELECT 1 FROM document_tags dt        WHERE dt.tag_id = t.id)
AND NOT EXISTS (SELECT 1 FROM user_topic_selections u WHERE u.tag_id  = t.id)
AND NOT EXISTS (SELECT 1 FROM major_suggested_tags m  WHERE m.tag_id  = t.id);

-- Bỏ cột song ngữ (nếu còn sót từ bản thử) — view phụ thuộc nên drop view trước
DROP VIEW IF EXISTS tag_usage;
ALTER TABLE tags DROP COLUMN IF EXISTS name_vi;

-- ─── View đếm độ phổ biến tag ───────────────────────────────────────────────
CREATE VIEW tag_usage AS
SELECT t.id, t.name, COUNT(dt.doc_id)::INT AS doc_count
FROM tags t
LEFT JOIN document_tags dt ON dt.tag_id = t.id
GROUP BY t.id, t.name;

-- ─── RPC gợi ý HYBRID: điểm = môn×3 + tag×1; ứng viên = hợp môn HOẶC trùng tag ─
-- Bỏ RPC tag-only của bản nháp (đã thay bằng hybrid)
DROP FUNCTION IF EXISTS recommend_documents_for_user(UUID, INT);

CREATE OR REPLACE FUNCTION recommend_documents_hybrid(p_user_id UUID, p_limit INT DEFAULT 12)
RETURNS TABLE (
  doc_id        INT,
  score         INT,
  subject_match BOOLEAN,
  tag_count     INT,
  subject_name  TEXT,
  matched_tags  TEXT[],
  view_count    INT
)
LANGUAGE sql STABLE AS $$
  WITH us AS (
    SELECT subject_id FROM user_subject_selections WHERE user_id = p_user_id
  ),
  tm AS (
    SELECT dt.doc_id,
           COUNT(*)::INT                     AS tag_count,
           ARRAY_AGG(t.name ORDER BY t.name) AS tags
    FROM document_tags dt
    JOIN user_topic_selections uts ON uts.tag_id = dt.tag_id AND uts.user_id = p_user_id
    JOIN tags t ON t.id = dt.tag_id
    GROUP BY dt.doc_id
  )
  SELECT
    d.id,
    ((CASE WHEN d.subject_id IN (SELECT subject_id FROM us) THEN 3 ELSE 0 END)
      + COALESCE(tm.tag_count, 0))::INT          AS score,
    (d.subject_id IN (SELECT subject_id FROM us)) AS subject_match,
    COALESCE(tm.tag_count, 0)                     AS tag_count,
    s.name                                        AS subject_name,
    COALESCE(tm.tags, '{}')                       AS matched_tags,
    d.view_count
  FROM documents d
  LEFT JOIN tm        ON tm.doc_id = d.id
  LEFT JOIN subjects s ON s.id = d.subject_id
  WHERE d.is_public = TRUE
    AND d.document_scope = 'library'
    AND d.lifecycle_status = 'active'
    AND d.deleted_at IS NULL
    AND d.user_id <> p_user_id
    AND (d.subject_id IN (SELECT subject_id FROM us) OR tm.doc_id IS NOT NULL)
  ORDER BY score DESC, d.view_count DESC, d.created_at DESC
  LIMIT p_limit;
$$;

-- ─── RLS (nhất quán migration 002; backend dùng service-role nên bypass) ─────
ALTER TABLE majors                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_topic_selections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subject_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE major_suggested_tags    ENABLE ROW LEVEL SECURITY;
