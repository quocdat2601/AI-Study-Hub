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
