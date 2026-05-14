-- Replace the password_hash value with a real bcrypt hash before running.
-- Generate hash locally:
-- npm run hash:password -- YourAdminPassword123

INSERT INTO users (email, password_hash, role)
VALUES (
  'admin@aistudyhub.com',
  'REPLACE_WITH_BCRYPT_HASH',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
