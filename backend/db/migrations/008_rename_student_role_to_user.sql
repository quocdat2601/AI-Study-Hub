-- Rename the default non-admin role from student to user.

UPDATE users
SET role = 'user'
WHERE role = 'student';

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'user';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin'));
