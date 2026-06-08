import api from "./api.js";

export async function getAccount() {
  const response = await api.get("/account");
  return response.data;
}

export async function updateAccountProfile(payload) {
  const response = await api.patch("/account/profile", payload);
  return response.data;
}

export async function updateAccountPreferences(payload) {
  const response = await api.patch("/account/preferences", payload);
  return response.data;
}

export async function updateAccountEmail(payload) {
  const response = await api.patch("/account/email", payload);
  return response.data;
}

export async function updateAccountPassword(payload) {
  const response = await api.patch("/account/password", payload);
  return response.data;
}

export async function uploadAccountAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);
  const response = await api.post("/account/avatar", formData);
  return response.data;
}

export async function upgradeAccountStorage() {
  const response = await api.post("/account/storage/upgrade");
  return response.data;
}
