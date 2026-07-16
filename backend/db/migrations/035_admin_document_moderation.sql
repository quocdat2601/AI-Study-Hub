-- Migration 035: Admin Document Moderation
-- Add moderation columns to record audit trails of document deletion/moderation by administrators.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS moderation_reason TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES users(id) ON DELETE SET NULL;
