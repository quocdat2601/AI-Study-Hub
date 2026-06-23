-- Add highlight anchor metadata for existing document_notes tables.

ALTER TABLE document_notes
  ADD COLUMN IF NOT EXISTS anchor JSONB NOT NULL DEFAULT '{}'::jsonb;
