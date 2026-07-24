export const MODEL_LABELS = {
  "gemini-3.6-flash": "Gemini 3.6 Flash",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "qwen2.5:3b": "Qwen 2.5 3B",
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
