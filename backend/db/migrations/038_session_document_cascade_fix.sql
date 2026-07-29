-- Sửa lỗi không xoá vĩnh viễn được tài liệu trong Trash (500 Internal server error).
--
-- TRIỆU CHỨNG
--   Documents -> Trash -> "Delete permanently" trả 500. Postgres báo:
--     update or delete on table "chat_sessions" violates foreign key constraint
--     "documents_origin_session_id_fkey" on table "documents"
--
-- NGUYÊN NHÂN — hai quy tắc khoá ngoại đụng nhau:
--
--   chat_sessions.primary_document_id -> documents   ON DELETE CASCADE
--     => xoá tài liệu thì phiên chat dùng nó làm tài liệu chính bị xoá theo
--
--   documents.origin_session_id -> chat_sessions     NO ACTION  (mặc định)
--     => còn tài liệu tạm trỏ vào phiên chat đó thì CẤM xoá phiên chat
--
--   Một bên bắt xoá, một bên cấm xoá. Gặp đúng tổ hợp thì cả lệnh xoá thất bại:
--   mở tài liệu trong Workspace (sinh phiên chat) -> tải file vào phiên đó ->
--   xoá phiên chat -> xoá tài liệu ban đầu -> nổ.
--
--   Migration 015 dòng 5 khai báo:
--       origin_session_id INT REFERENCES chat_sessions(id)
--   không ghi ON DELETE, nên Postgres mặc định thành NO ACTION.
--
-- VÌ SAO CHỌN CASCADE, KHÔNG PHẢI SET NULL
--   Migration 015 đã có sẵn ràng buộc:
--       CHECK (document_scope = 'library' OR origin_session_id IS NOT NULL)
--   tức là tài liệu scope 'session' BẮT BUỘC phải có phiên chat gốc. Đặt
--   origin_session_id về NULL sẽ vi phạm chính ràng buộc này.
--
--   CASCADE khớp đúng ý nghĩa đó: tài liệu tạm không thể tồn tại nếu phiên chat
--   gốc không còn. Tài liệu tạm vốn đã tự hết hạn sau 30 ngày; ai muốn giữ thì
--   đã dùng "Save to library" để chuyển nó thành tài liệu thư viện.
--
-- PHẠM VI ẢNH HƯỞNG
--   Backend không có chỗ nào xoá cứng chat_sessions (chỉ xoá mềm qua deleted_at),
--   nên CASCADE này chỉ kích hoạt qua đúng chuỗi mô tả ở trên.

DO $$
BEGIN
  -- Gỡ ràng buộc cũ nếu nó chưa phải CASCADE.
  IF EXISTS (
    SELECT 1
    FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc
      ON tc.constraint_name = rc.constraint_name
     AND tc.constraint_schema = rc.constraint_schema
    WHERE tc.table_name = 'documents'
      AND tc.constraint_name = 'documents_origin_session_id_fkey'
      AND rc.delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT documents_origin_session_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'documents'
      AND constraint_name = 'documents_origin_session_id_fkey'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_origin_session_id_fkey
      FOREIGN KEY (origin_session_id)
      REFERENCES chat_sessions(id)
      ON DELETE CASCADE;
  END IF;
END $$;
