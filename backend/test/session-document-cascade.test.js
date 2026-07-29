const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(
  path.join(root, 'db', 'migrations', '038_session_document_cascade_fix.sql'),
  'utf8'
);
const lifecycleMigration = fs.readFileSync(
  path.join(root, 'db', 'migrations', '015_session_document_lifecycle.sql'),
  'utf8'
);

test('origin_session_id được đặt lại thành ON DELETE CASCADE', () => {
  assert.match(migration, /DROP CONSTRAINT documents_origin_session_id_fkey/);
  assert.match(migration, /FOREIGN KEY \(origin_session_id\)[\s\S]*REFERENCES chat_sessions\(id\)[\s\S]*ON DELETE CASCADE/);
});

test('migration chạy lại được nhiều lần mà không lỗi', () => {
  // Chỉ gỡ khi quy tắc hiện tại khác CASCADE, chỉ thêm khi ràng buộc chưa có.
  assert.match(migration, /rc\.delete_rule <> 'CASCADE'/);
  assert.match(migration, /IF NOT EXISTS \([\s\S]*information_schema\.table_constraints/);
});

test('CASCADE là lựa chọn duy nhất khả thi vì CHECK của migration 015', () => {
  // SET NULL sẽ vi phạm chính ràng buộc này, nên đừng "sửa" lại thành SET NULL.
  assert.match(
    lifecycleMigration,
    /CHECK \(document_scope = 'library' OR origin_session_id IS NOT NULL\)/
  );
});
