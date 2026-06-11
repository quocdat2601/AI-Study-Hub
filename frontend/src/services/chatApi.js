import api from "./api.js";

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
