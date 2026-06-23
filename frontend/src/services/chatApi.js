import api from "./api.js";
import { UPLOAD_DOC_TIMEOUT_MS } from "./uploadDocApi.js";

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
