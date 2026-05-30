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
