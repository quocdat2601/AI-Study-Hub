-- Content-based deduplication for uploaded files.
-- Mỗi cloud_files lưu mã SHA-256 của nội dung tệp; các file có cùng nội dung
-- sẽ chia sẻ chung 1 object vật lý trên Storage (cùng storage_path).

ALTER TABLE cloud_files
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_cloud_files_content_hash
  ON cloud_files (content_hash);

-- Sao chép chunks + vector embedding sẵn có từ một document sang document khác,
-- để file trùng không phải gọi lại Embedding API. Trả về số chunk đã sao chép.
CREATE OR REPLACE FUNCTION copy_document_chunks(
  p_source_doc_id INT,
  p_target_doc_id INT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO document_chunks (
    doc_id, chunk_index, content, token_estimate, metadata,
    embedding, embedding_model, embedding_status, embedding_error
  )
  SELECT
    p_target_doc_id, chunk_index, content, token_estimate, metadata,
    embedding, embedding_model, embedding_status, embedding_error
  FROM document_chunks
  WHERE doc_id = p_source_doc_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
