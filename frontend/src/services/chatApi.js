import api from "./api.js";

export async function getOrCreateDocumentChatSession(docId) {
  const response = await api.get(`/chat/session/${docId}`);
  return response.data;
}

export async function getChatSessionMessages(sessionId) {
  const response = await api.get(`/chat/sessions/${sessionId}/messages`);
  return response.data;
}
