import api from "./api.js";

export async function listDocuments(params = {}) {
  const response = await api.get("/documents", { params });
  return response.data;
}

export async function getDocument(id) {
  const response = await api.get(`/documents/${id}`);
  return response.data;
}

export async function getDocumentSignedUrl(id) {
  const response = await api.get(`/documents/${id}/signed-url`);
  return response.data;
}

export async function getDocumentPreview(id) {
  const response = await api.get(`/documents/${id}/preview`, {
    responseType: "arraybuffer",
    timeout: 120000,
  });
  return response.data;
}

/** Trích xuất lại text từ file — backend dùng cho AI chat. */
export async function reextractDocumentText(id) {
  const response = await api.post(`/documents/${id}/reextract`, null, {
    timeout: 120000,
  });
  return response.data;
}

export async function listTrendingDocuments(limit = 5) {
  const response = await api.get("/public/documents/trending", { params: { limit } });
  return response.data;
}

export async function updateDocument(id, data) {
  const response = await api.patch(`/documents/${id}`, data);
  return response.data;
}

export async function deleteDocument(id) {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
}

export async function listDocumentShares(id) {
  const response = await api.get(`/documents/${id}/shares`);
  return response.data;
}

export async function shareDocument(id, email) {
  const response = await api.post(`/documents/${id}/shares`, { email });
  return response.data;
}

export async function revokeDocumentShare(id, shareId) {
  const response = await api.delete(`/documents/${id}/shares/${shareId}`);
  return response.data;
}
