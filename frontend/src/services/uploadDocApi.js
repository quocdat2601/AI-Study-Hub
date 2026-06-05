import api from "./api.js";

export const UPLOAD_DOC_MAX_SIZE_MB = 50;

export const UPLOAD_DOC_ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const UPLOAD_DOC_ACCEPT_ATTR =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function getUploadDocFileLabel(file) {
  if (file?.type === "application/pdf") return "PDF";
  if (file?.type?.includes("wordprocessingml")) return "DOCX";
  return "FILE";
}

export function validateUploadDocFile(file) {
  if (!UPLOAD_DOC_ACCEPTED_TYPES.includes(file.type)) {
    return "Only PDF and DOCX files are accepted.";
  }

  if (file.size > UPLOAD_DOC_MAX_SIZE_MB * 1024 * 1024) {
    return `Max file size is ${UPLOAD_DOC_MAX_SIZE_MB}MB.`;
  }

  return "";
}

/**
 * Gọi backend POST /api/upload-doc
 */
export async function uploadDocument({ file, title, subjectId, tags, onProgress, signal }) {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  if (subjectId) formData.append("subjectId", String(subjectId));
  if (tags?.trim()) formData.append("tags", tags.trim());

  const response = await api.post("/upload-doc", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    signal,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded * 100) / event.total));
    },
  });

  return response.data;
}
