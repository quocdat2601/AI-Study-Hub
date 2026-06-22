-- Highlight color for document notes (yellow, green, blue, pink, purple, orange).
-- Optional: color is also stored inside anchor JSONB when this column is missing.

ALTER TABLE document_notes
  ADD COLUMN IF NOT EXISTS color VARCHAR(20) NOT NULL DEFAULT 'yellow';
