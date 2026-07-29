export const MODEL_LABELS = {
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "gemini-3-flash": "Gemini 3 Flash",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  // "qwen2.5:1.5b": "Qwen 2.5 1.5B",
  "qwen2.5:3b": "Qwen 2.5 3B",
  // "qwen2.5:7b": "Qwen 2.5 7B",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o Mini",
  "o1-mini": "o1 Mini",
  "gpt-3.5-turbo": "GPT-3.5 Turbo",
  "claude-3-5-sonnet-latest": "Claude 3.5 Sonnet",
  "claude-3-5-haiku-latest": "Claude 3.5 Haiku",
  "claude-3-opus-latest": "Claude 3 Opus",
  "grok-beta": "Grok Beta",
  "grok-2": "Grok 2",
  "grok-2-mini": "Grok 2 Mini",
  "llama-3.3-70b-versatile": "Llama 3.3 70B",
  "llama-3.1-8b-instant": "Llama 3.1 8B",
  "mixtral-8x7b-32768": "Mixtral 8x7B",
  "gemma2-9b-it": "Gemma 2 9B",
};

export function getSubjectLabel(doc) {
  return doc.subjects?.code || doc.subjectCode || doc.subject || "No subject";
}

export function getStatusLabel(doc) {
  if (doc.extraction_status === "ready") return "Text ready";
  if (doc.extraction_status === "empty") return "No readable text";
  if (doc.extraction_status === "failed") return "Extraction failed";
  return "Ready to ask";
}
