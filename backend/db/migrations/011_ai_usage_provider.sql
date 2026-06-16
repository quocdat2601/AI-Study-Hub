-- Track which AI provider handled each request.

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'gemini'
    CHECK (provider IN ('gemini', 'ollama'));

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider_model_created
  ON ai_usage_logs(provider, model, created_at DESC);
