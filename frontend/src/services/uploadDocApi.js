import api from "./api.js";

export const UPLOAD_DOC_MAX_SIZE_MB = 50;
export const UPLOAD_DOC_TIMEOUT_MS = 10 * 60 * 1000;

export const UPLOAD_DOC_ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/bmp",
];

export const UPLOAD_DOC_ACCEPT_ATTR =
  ".pdf,.docx,.png,.jpg,.jpeg,.tif,.tiff,.bmp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/tiff,image/bmp";

export function getUploadDocFileLabel(file) {
  if (file?.type === "application/pdf") return "PDF";
  if (file?.type?.includes("wordprocessingml")) return "DOCX";
  if (file?.type?.startsWith("image/")) return "IMG";
  return "FILE";
}

export function validateUploadDocFile(file) {
  if (!UPLOAD_DOC_ACCEPTED_TYPES.includes(file.type)) {
    return "Only PDF, DOCX, PNG, JPEG, TIFF, and BMP files are accepted.";
  }

  if (file.size > UPLOAD_DOC_MAX_SIZE_MB * 1024 * 1024) {
    return `Max file size is ${UPLOAD_DOC_MAX_SIZE_MB}MB.`;
  }

  return "";
}

export function isUploadDocTimeoutError(error) {
  return error?.code === "ECONNABORTED"
    || error?.code === "ETIMEDOUT"
    || /timeout/i.test(String(error?.message || ""));
}

/**
 * Gọi backend POST /api/upload-doc
 */
export async function uploadDocument({ file, title, subjectId, tags, isPublic = false, onProgress, signal }) {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  if (subjectId) formData.append("subjectId", String(subjectId));
  if (tags?.trim()) formData.append("tags", tags.trim());
  formData.append("isPublic", String(Boolean(isPublic)));

  const response = await api.post("/upload-doc", formData, {
    signal,
    timeout: UPLOAD_DOC_TIMEOUT_MS,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded * 100) / event.total));
    },
  });

  return response.data;
}
