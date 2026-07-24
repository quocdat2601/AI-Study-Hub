import api from "./api.js";
import { getCachedPreviewData, setCachedPreviewData } from "./storageUrlCache.js";

export async function getWorkspaceBootstrap(params = {}) {
  const response = await api.get("/workspace/bootstrap", { params });
  return response.data;
}

export async function getWorkspaceDocumentContext(id) {
  const response = await api.get(`/workspace/documents/${id}`);
  return response.data;
}

function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function fetchWorkspacePdf(id) {
  const cacheKey = `workspace-pdf:${id}`;
  const cached = getCachedPreviewData(cacheKey);
  if (cached) return cached;

  const response = await api.get(`/workspace/documents/${id}/preview-data`, {
    responseType: "arraybuffer",
    timeout: 120000,
  });
  return setCachedPreviewData(cacheKey, response.data);
}

export async function sendWorkspaceMessage(sessionId, content) {
  const response = await api.post(`/workspace/sessions/${sessionId}/messages`, { content });
  return response.data;
}

export async function addWorkspaceBookmark(docId) {
  const response = await api.post(`/workspace/documents/${docId}/bookmark`);
  return response.data;
}

export async function removeWorkspaceBookmark(docId) {
  const response = await api.delete(`/workspace/documents/${docId}/bookmark`);
  return response.data;
}

export async function listWorkspaceNotes(docId) {
  const response = await api.get(`/workspace/documents/${docId}/notes`);
  return response.data;
}

export async function createWorkspaceNote(docId, payload) {
  const response = await api.post(`/workspace/documents/${docId}/notes`, payload);
  return response.data;
}

export async function updateWorkspaceNote(docId, noteId, payload) {
  const response = await api.patch(`/workspace/documents/${docId}/notes/${noteId}`, payload);
  return response.data;
}

export async function deleteWorkspaceNote(docId, noteId) {
  const response = await api.delete(`/workspace/documents/${docId}/notes/${noteId}`);
  return response.data;
}
