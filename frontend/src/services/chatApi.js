import api from "./api.js";

export async function listChatSessions() {
  const response = await api.get("/chat/sessions");
  return response.data;
}
