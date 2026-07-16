-- Create announcements table for system-wide broadcasts
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  message VARCHAR(500) NOT NULL,
  target_role VARCHAR(10) NOT NULL DEFAULT 'all' CHECK (target_role IN ('all','user','admin')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track which announcements have been read by which users
CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id INT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements (created_at);

-- Enable RLS (RLS bypassed on backend via service-role key)
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
