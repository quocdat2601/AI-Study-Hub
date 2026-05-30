import api from "./api.js";

export async function listChatSessions() {
  const response = await api.get("/chat/sessions");
  return response.data;
}

export async function createChatSession(title) {
  const response = await api.post("/chat/sessions", { title });
  return response.data;
}

export async function getChatSession(sessionId) {
  const response = await api.get(`/chat/sessions/${sessionId}`);
  return response.data;
}

export async function updateChatSession(sessionId, title) {
  const response = await api.patch(`/chat/sessions/${sessionId}`, { title });
  return response.data;
}

export async function deleteChatSession(sessionId) {
  const response = await api.delete(`/chat/sessions/${sessionId}`);
  return response.data;
}

export async function addDocumentToSession(sessionId, docId) {
  const response = await api.post(`/chat/sessions/${sessionId}/documents`, { docId });
  return response.data;
}

export async function removeDocumentFromSession(sessionId, docId) {
  const response = await api.delete(`/chat/sessions/${sessionId}/documents/${docId}`);
  return response.data;
}

export async function getChatMessages(sessionId, params = {}) {
  const response = await api.get(`/chat/sessions/${sessionId}/messages`, { params });
  return response.data;
}

export async function sendChatMessage(sessionId, content) {
  const response = await api.post(`/chat/sessions/${sessionId}/messages`, { content });
  return response.data;
}
