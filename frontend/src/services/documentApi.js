import api from "./api.js";

export async function listDocuments(params = {}) {
  const response = await api.get("/documents", { params });
  return response.data;
}

export async function getDocument(id, options = {}) {
  const response = await api.get(`/documents/${id}`, {
    suppressAuthRedirect: Boolean(options.suppressAuthRedirect),
  });
  return response.data;
}

export async function getDocumentSignedUrl(id, options = {}) {
  const response = await api.get(`/documents/${id}/signed-url`, {
    suppressAuthRedirect: Boolean(options.suppressAuthRedirect),
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
