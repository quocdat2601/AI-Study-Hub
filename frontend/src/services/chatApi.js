import api from "./api.js";
import { UPLOAD_DOC_TIMEOUT_MS } from "./uploadDocApi.js";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function getOrCreateDocumentChatSession(docId, { signal } = {}) {
  const response = await api.get(`/chat/session/${docId}`, { signal });
  return response.data;
}

export async function getChatSessionMessages(sessionId, { signal } = {}) {
  const response = await api.get(`/chat/sessions/${sessionId}/messages`, { signal });
  return response.data;
}

export const getOrCreateChatSession = getOrCreateDocumentChatSession;
export const getChatMessages = getChatSessionMessages;

export async function sendChatMessage(sessionId, content) {
  const response = await api.post(`/chat/sessions/${sessionId}/messages`, { content });
  return response.data;
}

export async function listChatSessions(documentId, { signal } = {}) {
  const response = await api.get("/chat/sessions", {
    params: { documentId },
    signal,
  });
  return response.data;
}

export async function createChatSession({ title, documentId, signal } = {}) {
  const response = await api.post("/chat/sessions", { title, documentId }, { signal });
  return response.data;
}

export async function renameChatSession(sessionId, title, { signal } = {}) {
  const response = await api.patch(`/chat/sessions/${sessionId}`, { title }, { signal });
  return response.data;
}

export async function deleteChatSession(sessionId, { signal } = {}) {
  const response = await api.delete(`/chat/sessions/${sessionId}`, { signal });
  return response.data;
}

export async function attachChatDocument(sessionId, documentId, { signal } = {}) {
  const response = await api.post(`/chat/sessions/${sessionId}/documents`, { documentId }, { signal });
  return response.data;
}

export async function uploadChatDocument(sessionId, file, { onProgress, signal, uploadRequestId } = {}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", file.name);
  if (uploadRequestId) formData.append("uploadRequestId", uploadRequestId);

  const response = await api.post(`/chat/sessions/${sessionId}/documents/upload`, formData, {
    signal,
    timeout: UPLOAD_DOC_TIMEOUT_MS,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded * 100) / event.total));
    },
  });
  return response.data;
}

export async function detachChatDocument(sessionId, documentId, { signal } = {}) {
  const response = await api.delete(`/chat/sessions/${sessionId}/documents/${documentId}`, { signal });
  return response.data;
}

export async function restoreChatDocument(sessionId, documentId, { signal } = {}) {
  const response = await api.post(`/chat/sessions/${sessionId}/documents/${documentId}/restore`, null, { signal });
  return response.data;
}

export async function saveChatDocumentToLibrary(sessionId, documentId, { signal } = {}) {
  const response = await api.post(`/chat/sessions/${sessionId}/documents/${documentId}/save-to-library`, null, { signal });
  return response.data;
}

export async function reprocessChatDocument(sessionId, documentId, { signal } = {}) {
  const response = await api.post(`/chat/sessions/${sessionId}/documents/${documentId}/reprocess`, null, { signal });
  return response.data;
}

export async function getChatShareOptions(sessionId) {
  const response = await api.get(`/chat/sessions/${sessionId}/share-options`);
  return response.data;
}

export async function createChatSnapshot(sessionId, selection) {
  const response = await api.post(`/chat/sessions/${sessionId}/snapshots`, selection);
  return response.data;
}

export async function listSharedLinks() {
  const response = await api.get('/chat/shared-links');
  return response.data;
}

export async function disableSharedLink(linkId) {
  const response = await api.delete(`/chat/shared-links/${linkId}`);
  return response.data;
}

export async function updateSharedLinkAccess(linkId, access) {
  const response = await api.patch(`/chat/shared-links/${linkId}/access`, { access });
  return response.data;
}

export async function registerSharedSnapshotOpen(token) {
  const response = await api.post(`/chat/shared-snapshots/${token}/open`);
  return response.data;
}

export async function listReceivedSharedLinks() {
  const response = await api.get('/chat/received-shared-links');
  return response.data;
}

export async function removeReceivedSharedLink(recipientId) {
  const response = await api.delete(`/chat/received-shared-links/${recipientId}`);
  return response.data;
}

export async function getPublicChatSnapshot(token) {
  const response = await fetch(`${API_BASE_URL}/public/chat-snapshots/${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Shared chat is unavailable.");
    error.response = { status: response.status, data };
    throw error;
  }
  return data;
}

export async function importChatSnapshot(token) {
  const response = await api.post(`/chat/shared-snapshots/${token}/import`);
  return response.data;
}

export async function getSnapshotDocumentDownload(token, snapshotDocumentId) {
  const response = await api.get(`/chat/shared-snapshots/${token}/documents/${snapshotDocumentId}/download`);
  return response.data;
}

export async function listSharedChats() {
  const response = await api.get('/chat/shared-chats');
  return response.data;
}

export async function listSharedDocuments() {
  const response = await api.get('/chat/shared-documents');
  return response.data;
}

export async function getSharedDocumentDownload(documentId) {
  const response = await api.get(`/chat/shared-documents/${documentId}/download`);
  return response.data;
}

export async function saveSharedDocumentToLibrary(documentId) {
  const response = await api.post(`/chat/shared-documents/${documentId}/save-to-library`);
  return response.data;
}
