-- SQL migration to add download_count to documents and create document_comments table with RLS policies

ALTER TABLE documents ADD COLUMN IF NOT EXISTS download_count INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS document_comments (
  id          SERIAL PRIMARY KEY,
  doc_id      INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  rating      INT CHECK (rating >= 1 AND rating <= 5),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_comments_doc_id ON document_comments(doc_id);

-- Enable RLS
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- Select policy
DROP POLICY IF EXISTS "Anyone can view document comments" ON document_comments;
CREATE POLICY "Anyone can view document comments" ON document_comments
  FOR SELECT USING (true);

-- Insert policy
DROP POLICY IF EXISTS "Authenticated users can insert document comments" ON document_comments;
CREATE POLICY "Authenticated users can insert document comments" ON document_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Update policy
DROP POLICY IF EXISTS "Users can update their own document comments" ON document_comments;
CREATE POLICY "Users can update their own document comments" ON document_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Delete policy
DROP POLICY IF EXISTS "Users can delete their own document comments" ON document_comments;
CREATE POLICY "Users can delete their own document comments" ON document_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE document_comments FORCE ROW LEVEL SECURITY;
