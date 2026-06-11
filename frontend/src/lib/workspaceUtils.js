const SUBJECT_COLORS = {
  CS301: "#3b6fd4",
  CS202: "#7c4dbd",
  CS302: "#2d9e6b",
};

export function getSubjectColor(code) {
  if (!code) return "#5b6af8";
  const normalized = String(code).toUpperCase();
  return SUBJECT_COLORS[normalized] || "#5b6af8";
}

export function formatWorkspaceDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getFileTypeLabel(mimeType) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType?.includes("wordprocessingml")) return "DOCX";
  return "FILE";
}

export function isPdfDocument(doc) {
  return doc?.cloud_files?.mime_type === "application/pdf";
}

export function getExtractionStatus(doc) {
  return doc?.extraction_status || doc?.extractionStatus || "pending";
}

export function needsTextExtraction(doc) {
  return getExtractionStatus(doc) !== "ready";
}

export function mapWorkspaceDocument(doc, bookmarkIds, userId) {
  const mimeType = doc.cloud_files?.mime_type || "";
  const subjectCode = doc.subjects?.code || doc.subjects?.name || "OTHER";

  return {
    id: String(doc.id),
    title: doc.title || "Untitled document",
    subject: subjectCode,
    date: formatWorkspaceDate(doc.updated_at || doc.created_at),
    type: getFileTypeLabel(mimeType),
    mimeType,
    bookmarked: bookmarkIds.has(Number(doc.id)),
    isShared: String(doc.user_id) !== String(userId),
    raw: doc,
  };
}
