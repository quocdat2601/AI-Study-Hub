-- Map legacy Supabase role "user" to application role "student"
UPDATE users
SET role = 'student', updated_at = NOW()
WHERE role = 'user';
