-- Debug metadata for document text extraction and OCR.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS extraction_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
