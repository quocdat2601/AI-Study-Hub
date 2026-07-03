-- Document Roadmaps (per user per document)
-- Stores an AI-generated (and user-editable) study roadmap for a specific document.

create table if not exists document_roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  doc_id bigint not null references documents(id) on delete cascade,
  goal text null,
  roadmap jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, doc_id)
);

create index if not exists idx_document_roadmaps_user_id on document_roadmaps(user_id);
create index if not exists idx_document_roadmaps_doc_id on document_roadmaps(doc_id);

