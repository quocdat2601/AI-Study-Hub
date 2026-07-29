-- Migration: Create user_api_keys table for BYOK (Bring Your Own Key) feature
-- Run this in your Supabase SQL editor or via migration tool.

CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,                -- e.g. 'gemini', 'openai', 'anthropic', 'grok'
  masked_key     TEXT NOT NULL,                -- e.g. 'AIza****abcd'
  encrypted_iv          TEXT NOT NULL,         -- AES-256-GCM IV (hex)
  encrypted_tag         TEXT NOT NULL,         -- AES-256-GCM auth tag (hex)
  encrypted_ciphertext  TEXT NOT NULL,         -- AES-256-GCM ciphertext (hex)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One key per provider per user
  CONSTRAINT uq_user_api_keys_user_provider UNIQUE (user_id, provider)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON public.user_api_keys(user_id);

-- RLS: only the owning user can read/write their own keys
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- The backend uses the service-role key which bypasses RLS,
-- so these policies protect direct Supabase client access only.
CREATE POLICY "Users can view their own keys"
  ON public.user_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own keys"
  ON public.user_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own keys"
  ON public.user_api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own keys"
  ON public.user_api_keys FOR DELETE
  USING (auth.uid() = user_id);
