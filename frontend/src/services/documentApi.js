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

export async function listTrendingDocuments(limit = 12) {
  const response = await api.get("/public/documents/trending", { params: { limit } });
  return response.data;
}

export async function searchPublicDocuments(params = {}) {
  const response = await api.get("/public/documents", { params });
  return response.data;
}

export async function getPublicDocument(id) {
  const response = await api.get(`/public/documents/${id}`);
  return response.data;
}

export async function getPublicDocumentSignedUrl(id) {
  const response = await api.get(`/public/documents/${id}/signed-url`);
  return response.data;
}

export async function listDocumentComments(id) {
  const response = await api.get(`/public/documents/${id}/comments`);
  return response.data;
}

export async function addDocumentComment(id, content, rating = null) {
  const response = await api.post(`/public/documents/${id}/comments`, { content, rating });
  return response.data;
}

export async function updateDocument(id, data) {
  const response = await api.patch(`/documents/${id}`, data);
  return response.data;
}

export async function updateDocumentVisibility(id, isPublic) {
  const response = await api.patch(`/documents/${id}/visibility`, { isPublic });
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
