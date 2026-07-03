import api from "./api.js";

export async function getRoadmap(docId) {
  const response = await api.get(`/roadmap/documents/${docId}`);
  return response.data;
}

export async function generateRoadmap(docId, { goal } = {}) {
  const response = await api.post(`/roadmap/documents/${docId}/generate`, { goal }, {
    timeout: 120000,
  });
  return response.data;
}

export async function updateRoadmapTask(docId, taskId, status) {
  const response = await api.patch(
    `/roadmap/documents/${docId}/tasks/${encodeURIComponent(taskId)}`,
    { status }
  );
  return response.data;
}

