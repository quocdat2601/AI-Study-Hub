-- Replace the password_hash value with a real bcrypt hash before running.
-- Generate hash locally:
-- npm run hash:password -- YourAdminPassword123

INSERT INTO users (email, password_hash, role, status)
VALUES (
  'admin@aistudyhub.com',
  '$2b$10$vtI3MwumK6cAXLORXQk6juXHIcjLieISiDqhTiaIG5/g5HCX92so2',
  'admin',
  'active'
)
ON CONFLICT (email) DO NOTHING;