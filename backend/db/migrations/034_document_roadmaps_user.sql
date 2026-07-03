-- Document Roadmaps (per user per document)
-- NOTE: The project already has a legacy `document_roadmaps` table with a different schema.
-- This migration creates a new table dedicated to user-specific study roadmaps.

create table if not exists document_roadmaps_user (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  doc_id bigint not null references documents(id) on delete cascade,
  goal text null,
  roadmap jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, doc_id)
);

create index if not exists idx_document_roadmaps_user_user_id on document_roadmaps_user(user_id);
create index if not exists idx_document_roadmaps_user_doc_id on document_roadmaps_user(doc_id);

