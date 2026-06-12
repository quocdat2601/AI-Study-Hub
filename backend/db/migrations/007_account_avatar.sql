-- Avatar storage path for user profile picture

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_path VARCHAR(500);
