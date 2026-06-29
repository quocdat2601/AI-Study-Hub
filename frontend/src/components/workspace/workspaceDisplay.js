export const MODEL_LABELS = {
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "gemini-3-flash": "Gemini 3 Flash",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  // "qwen2.5:1.5b": "Qwen 2.5 1.5B",
  "qwen2.5:3b": "Qwen 2.5 3B",
  // "qwen2.5:7b": "Qwen 2.5 7B",
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
