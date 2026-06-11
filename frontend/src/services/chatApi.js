import api from "./api.js";

const CHAT_TIMEOUT_MS = 120000;

export async function getOrCreateChatSession(docId) {
  const response = await api.get(`/chat/session/${docId}`);
  return response.data;
}

export async function getChatSessionMessages(sessionId) {
  const response = await api.get(`/chat/sessions/${sessionId}/messages`);
  return response.data;
}

export async function sendChatMessage(sessionId, content) {
  const response = await api.post(
    `/chat/sessions/${sessionId}/messages`,
    { content },
    { timeout: CHAT_TIMEOUT_MS }
  );
  return response.data;
}
