import api from "./api.js";

export async function getOnboardingOptions() {
  const response = await api.get("/onboarding/options");
  return response.data;
}

export async function getSuggestedTags(majorId) {
  const response = await api.get("/onboarding/suggested-tags", { params: { majorId } });
  return response.data;
}

export async function getSubjectsByMajor(majorId) {
  const response = await api.get("/onboarding/subjects", { params: { majorId } });
  return response.data;
}

export async function getOnboardingStatus() {
  const response = await api.get("/onboarding");
  return response.data;
}

export async function saveOnboarding({ majorId, goal, subjects, topics }) {
  const response = await api.put("/onboarding", { majorId, goal, subjects, topics });
  return response.data;
}

export async function getRecommendations(limit = 12) {
  const response = await api.get("/onboarding/recommendations", { params: { limit } });
  return response.data;
}

export async function searchTags(q, limit = 8) {
  const response = await api.get("/tags", { params: { q, limit } });
  return response.data;
}
