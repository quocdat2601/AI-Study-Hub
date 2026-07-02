-- Bổ sung môn học cho các ngành ngoài CNTT (QTKD, TRUYENTHONG, NGONNGU, LUAT),
-- tiếp nối ghi chú "các ngành khác bổ sung sau" ở migration 017.
-- Idempotent: chạy lại nhiều lần không tạo trùng (ON CONFLICT theo code).
--
-- ⚠️ Một số MÃ MÔN (code) ngoài CNTT cần đối chiếu lại với FAP/CTĐT chính thức của FPT
--    trước khi dùng cho production. Tên môn đúng, chỉ mã có thể lệch theo khóa/cơ sở.

INSERT INTO subjects (code, name, description, major_id, created_by)
SELECT
  v.code,
  v.name,
  v.description,
  (SELECT id FROM majors WHERE code = v.major_code),
  (SELECT id FROM users WHERE role = 'admin' AND status = 'active' ORDER BY id LIMIT 1)
FROM (VALUES
  -- ─── CNTT (bổ sung cho đủ; môn đã có sẽ được cập nhật, không tạo trùng) ──────
  ('PRF192',  'Programming Fundamentals',        'Nhập môn lập trình.',                         'CNTT'),
  ('PRO192',  'Object-Oriented Programming',     'Lập trình hướng đối tượng.',                  'CNTT'),
  ('CSD201',  'Data Structures & Algorithms',    'Cấu trúc dữ liệu và giải thuật.',             'CNTT'),
  ('DBI202',  'Database Systems',                'Hệ quản trị cơ sở dữ liệu, SQL.',             'CNTT'),
  ('PRJ301',  'Java Web Application Development', 'Phát triển ứng dụng web với Java.',           'CNTT'),
  ('SWP391',  'Software Development Project',     'Đồ án phát triển phần mềm.',                  'CNTT'),
  ('MAD101',  'Discrete Mathematics',            'Toán rời rạc.',                               'CNTT'),
  ('OSG202',  'Operating Systems',               'Hệ điều hành.',                               'CNTT'),
  ('NWC203c', 'Computer Networking',             'Mạng máy tính.',                              'CNTT'),
  ('PRN212',  'C# .NET Programming',             'Lập trình C# trên nền .NET.',                 'CNTT'),

  -- ─── QTKD – Quản trị kinh doanh ─────────────────────────────────────────────
  ('ECO121',  'Microeconomics',                  'Kinh tế vi mô.',                              'QTKD'),
  ('MKT101',  'Marketing Principles',            'Nguyên lý marketing.',                        'QTKD'),
  ('ACC101',  'Principles of Accounting',        'Nguyên lý kế toán.',                          'QTKD'),
  ('MAS291',  'Statistics & Probability',        'Xác suất thống kê ứng dụng.',                 'QTKD'),
  ('FIN202',  'Corporate Finance',               'Tài chính doanh nghiệp.',                     'QTKD'),
  ('MGT103',  'Introduction to Management',      'Nhập môn quản trị.',                          'QTKD'),
  ('OBE102c', 'Organizational Behavior',         'Hành vi tổ chức.',                            'QTKD'),
  ('IBI101',  'International Business',           'Kinh doanh quốc tế.',                         'QTKD'),

  -- ─── TRUYENTHONG – Công nghệ truyền thông ───────────────────────────────────
  ('PRE101',  'Principles of Communication',     'Nguyên lý truyền thông.',                     'TRUYENTHONG'),
  ('MUL101',  'Multimedia Design',               'Thiết kế đa phương tiện.',                    'TRUYENTHONG'),
  ('JOU101',  'Journalism Foundations',          'Cơ sở báo chí.',                              'TRUYENTHONG'),
  ('ADV101',  'Advertising',                     'Quảng cáo.',                                  'TRUYENTHONG'),
  ('PRL101',  'Public Relations',                'Quan hệ công chúng.',                         'TRUYENTHONG'),
  ('CON101',  'Content Creation',                'Sáng tạo nội dung.',                          'TRUYENTHONG'),

  -- ─── NGONNGU – Ngôn ngữ (Anh/Nhật/Hàn/Trung) ────────────────────────────────
  ('ENG101',  'English Communication',           'Tiếng Anh giao tiếp.',                        'NGONNGU'),
  ('TRA101',  'Translation & Interpretation',    'Biên - phiên dịch.',                          'NGONNGU'),
  ('LIN101',  'Introduction to Linguistics',     'Nhập môn ngôn ngữ học.',                      'NGONNGU'),
  ('JPD113',  'Elementary Japanese',             'Tiếng Nhật sơ cấp.',                          'NGONNGU'),
  ('KOR101',  'Elementary Korean',               'Tiếng Hàn sơ cấp.',                           'NGONNGU'),
  ('CHI101',  'Elementary Chinese',              'Tiếng Trung sơ cấp.',                         'NGONNGU'),

  -- ─── LUAT – Luật ────────────────────────────────────────────────────────────
  ('LAW101',  'Introduction to Law',             'Nhập môn luật học.',                          'LUAT'),
  ('BUL101',  'Business Law',                     'Luật kinh doanh.',                            'LUAT'),
  ('CIL101',  'Civil Law',                        'Luật dân sự.',                                'LUAT'),
  ('CRL101',  'Criminal Law',                     'Luật hình sự.',                               'LUAT'),
  ('INL101',  'International Law',                'Luật quốc tế.',                               'LUAT'),
  ('COL101',  'Constitutional Law',              'Luật hiến pháp.',                             'LUAT')
) AS v(code, name, description, major_code)
ON CONFLICT (code) DO UPDATE
  SET name       = EXCLUDED.name,
      major_id   = EXCLUDED.major_id,
      updated_at = NOW();
