-- Roadmap-level learning goal ("Sau lộ trình này bạn sẽ ...") shown above the steps.

ALTER TABLE document_roadmaps ADD COLUMN IF NOT EXISTS goal TEXT;
