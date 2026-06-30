-- Rename majors to English; keep code as the stable key. Also sync users.major
-- copies that were stored at onboarding time so existing users stay consistent.

UPDATE majors SET name = 'Information Technology'   WHERE code = 'CNTT';
UPDATE majors SET name = 'Business Administration'  WHERE code = 'QTKD';
UPDATE majors SET name = 'Communication Technology' WHERE code = 'TRUYENTHONG';
UPDATE majors SET name = 'Languages'                WHERE code = 'NGONNGU';
UPDATE majors SET name = 'Law'                      WHERE code = 'LUAT';

-- Sync existing users.major (stores the name string, not the id)
UPDATE users SET major = 'Information Technology'   WHERE major = 'Công nghệ thông tin';
UPDATE users SET major = 'Business Administration'  WHERE major = 'Quản trị kinh doanh';
UPDATE users SET major = 'Communication Technology' WHERE major = 'Công nghệ truyền thông';
UPDATE users SET major = 'Languages'                WHERE major = 'Ngôn ngữ';
UPDATE users SET major = 'Law'                      WHERE major = 'Luật';
