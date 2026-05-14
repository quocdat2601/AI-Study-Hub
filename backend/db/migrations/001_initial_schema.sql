-- AI Study Hub - Initial Database Schema
-- PostgreSQL / Supabase

CREATE TABLE IF NOT EXISTS users (
  id                  SERIAL PRIMARY KEY,
  email               VARCHAR(255) NOT NULL UNIQUE,
  password_hash       VARCHAR(255) NOT NULL,
  role                VARCHAR(10)  NOT NULL DEFAULT 'student'
                        CHECK (role IN ('student', 'admin')),
  status              VARCHAR(10)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'disabled')),
  storage_limit_bytes BIGINT NOT NULL DEFAULT 524288000,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  last_login_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS subjects (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  description TEXT,
  created_by  INT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cloud_files (
  id           SERIAL PRIMARY KEY,
  storage_path VARCHAR(500) NOT NULL,
  mime_type    VARCHAR(100) NOT NULL,
  size_bytes   BIGINT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  user_id    INT NOT NULL REFERENCES users(id),
  subject_id INT REFERENCES subjects(id) ON DELETE SET NULL,
  file_id    INT NOT NULL UNIQUE REFERENCES cloud_files(id),
  status     VARCHAR(10) NOT NULL DEFAULT 'uploaded'
               CHECK (status IN ('uploaded', 'indexed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_tags (
  doc_id     INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id     INT NOT NULL REFERENCES tags(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (doc_id, tag_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_id     INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, doc_id)
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id               SERIAL PRIMARY KEY,
  user_id          INT NOT NULL REFERENCES users(id),
  doc_id           INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, doc_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doc_shares (
  id         SERIAL PRIMARY KEY,
  doc_id     INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  shared_by  INT NOT NULL REFERENCES users(id),
  shared_to  INT NOT NULL REFERENCES users(id),
  status     VARCHAR(10) NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (doc_id, shared_to),
  CHECK (shared_by != shared_to)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(20) NOT NULL DEFAULT 'share'
               CHECK (type IN ('share', 'system')),
  message    VARCHAR(500) NOT NULL,
  ref_doc_id INT REFERENCES documents(id) ON DELETE SET NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(60) NOT NULL,
  target_type VARCHAR(50),
  target_id   INT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
