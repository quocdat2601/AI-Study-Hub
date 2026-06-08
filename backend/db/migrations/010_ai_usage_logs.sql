-- Local Gemini usage tracking for MVP quota display and safeguards.

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  doc_id INT REFERENCES documents(id) ON DELETE SET NULL,
  model VARCHAR(80) NOT NULL,
  request_type VARCHAR(40) NOT NULL DEFAULT 'document_qa',
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  request_count INT NOT NULL DEFAULT 1,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  error_code VARCHAR(80),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model_created
  ON ai_usage_logs(model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_model_created
  ON ai_usage_logs(user_id, model, created_at DESC);

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_logs_select_own ON ai_usage_logs;
CREATE POLICY ai_usage_logs_select_own ON ai_usage_logs
  FOR SELECT
  USING (auth.uid() = user_id);
