import api from "./api.js";

export async function getDashboardData() {
  const response = await api.get("/dashboard");
  return response.data;
}
