-- Account profile and preferences on users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS handle VARCHAR(50),
  ADD COLUMN IF NOT EXISTS major VARCHAR(120),
  ADD COLUMN IF NOT EXISTS theme VARCHAR(10) NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS language VARCHAR(20) NOT NULL DEFAULT 'en-US';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_theme_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_theme_check CHECK (theme IN ('light', 'dark'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_handle_unique_idx
  ON users (handle)
  WHERE handle IS NOT NULL;
