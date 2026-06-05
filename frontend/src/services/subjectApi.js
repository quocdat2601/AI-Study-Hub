import api from "./api.js";

export async function listSubjects() {
  const response = await api.get("/subjects");
  return response.data;
}
