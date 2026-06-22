import api from "./api.js";
import { UPLOAD_DOC_TIMEOUT_MS } from "./uploadDocApi.js";

export async function getOrCreateDocumentChatSession(docId) {
  const response = await api.get(`/chat/session/${docId}`);
  return response.data;
}

export async function getChatSessionMessages(sessionId) {
  const response = await api.get(`/chat/sessions/${sessionId}/messages`);
  return response.data;
}

export const getOrCreateChatSession = getOrCreateDocumentChatSession;
export const getChatMessages = getChatSessionMessages;

export async function sendChatMessage(sessionId, content) {
  const response = await api.post(`/chat/sessions/${sessionId}/messages`, { content });
  return response.data;
}

export async function attachChatDocument(sessionId, documentId) {
  const response = await api.post(`/chat/sessions/${sessionId}/documents`, { documentId });
  return response.data;
}

export async function uploadChatDocument(sessionId, file, { onProgress, signal } = {}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", file.name);

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

export async function detachChatDocument(sessionId, documentId) {
  const response = await api.delete(`/chat/sessions/${sessionId}/documents/${documentId}`);
  return response.data;
}

export async function restoreChatDocument(sessionId, documentId) {
  const response = await api.post(`/chat/sessions/${sessionId}/documents/${documentId}/restore`);
  return response.data;
}

export async function saveChatDocumentToLibrary(sessionId, documentId) {
  const response = await api.post(`/chat/sessions/${sessionId}/documents/${documentId}/save-to-library`);
  return response.data;
}
