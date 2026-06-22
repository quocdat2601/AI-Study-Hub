import api from "./api.js";

export async function sendChatbotMessage(message) {
  const response = await api.post("/chatbot/message", { message });
  return response.data;
}
