import api from "./api.js";

export async function processDocumentForAi(id) {
  const response = await api.post(`/ai/documents/${id}/process`);
  return response.data;
}

export async function askDocument(id, question, mode = "hybrid", model) {
  const response = await api.post(`/ai/documents/${id}/ask`, { question, mode, model });
  return response.data;
}

export async function getAiUsage(model) {
  const response = await api.get("/ai/usage", { params: model ? { model } : {} });
  return response.data;
}

export async function getAiModelStatus() {
  const response = await api.get("/ai/models/status");
  return response.data;
}
