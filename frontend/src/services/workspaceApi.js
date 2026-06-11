import api from "./api.js";

/** Tải sidebar: documents + subjects + bookmarks */
export async function getWorkspaceBootstrap(params = {}) {
  const response = await api.get("/workspace/bootstrap", { params });
  return response.data;
}

/** Tải 1 tài liệu: detail + PDF link + chat */
export async function getWorkspaceDocumentContext(id) {
  const response = await api.get(`/workspace/documents/${id}`);
  return response.data;
}

/** Tải file PDF qua backend (tránh CORS với Supabase signed URL) */
export async function fetchWorkspacePdf(id) {
  const response = await api.get(`/workspace/documents/${id}/pdf`, {
    responseType: "arraybuffer",
    timeout: 120000,
  });
  return response.data;
}

/** Gửi tin nhắn AI */
export async function sendWorkspaceMessage(sessionId, content) {
  const response = await api.post(`/workspace/sessions/${sessionId}/messages`, { content });
  return response.data;
}

/** Thêm bookmark */
export async function addWorkspaceBookmark(docId) {
  const response = await api.post(`/workspace/documents/${docId}/bookmark`);
  return response.data;
}

/** Gỡ bookmark */
export async function removeWorkspaceBookmark(docId) {
  const response = await api.delete(`/workspace/documents/${docId}/bookmark`);
  return response.data;
}
