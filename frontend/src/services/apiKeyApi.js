import api from "./api.js";

export async function saveApiKey(rawKey) {
  const response = await api.post("/keys/save", { rawKey });
  return response.data;
}

export async function listApiKeys() {
  const response = await api.get("/keys");
  return response.data;
}

export async function deleteApiKey(provider) {
  const response = await api.delete(`/keys/${provider}`);
  return response.data;
}
