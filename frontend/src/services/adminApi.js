import api from "./api.js";

export async function listAdminUsers() {
  const response = await api.get("/admin/users");
  return response.data;
}

export async function getAdminOverview() {
  const response = await api.get("/admin/overview");
  return response.data;
}

export async function updateAdminUser(id, updates) {
  const response = await api.patch(`/admin/users/${id}`, updates);
  return response.data;
}

export async function listAdminSubjects() {
  const response = await api.get("/admin/subjects");
  return response.data;
}

export async function createAdminSubject(subject) {
  const response = await api.post("/admin/subjects", subject);
  return response.data;
}

export async function updateAdminSubject(id, data) {
  const response = await api.patch(`/admin/subjects/${id}`, data);
  return response.data;
}

export async function deleteAdminSubject(id) {
  const response = await api.delete(`/admin/subjects/${id}`);
  return response.data;
}

export async function listAdminDocuments(params = {}) {
  const response = await api.get("/admin/documents", { params });
  return response.data;
}

export async function purgeAdminDocument(id) {
  const response = await api.delete(`/documents/${id}/purge`);
  return response.data;
}

export async function listAdminCommunityReports(params = {}) {
  const response = await api.get("/admin/community/reports", { params });
  return response.data;
}

export async function resolveAdminCommunityReport(id, status) {
  const response = await api.patch(`/admin/community/reports/${id}`, { status });
  return response.data;
}

export async function moderateAdminCommunityPost(id, status) {
  const response = await api.patch(`/admin/community/posts/${id}`, { status });
  return response.data;
}

export async function moderateAdminCommunityReply(id, status) {
  const response = await api.patch(`/admin/community/replies/${id}`, { status });
  return response.data;
}

export async function getAiUsage() {
  const response = await api.get("/admin/ai-usage");
  return response.data;
}

export async function createAnnouncement(data) {
  const response = await api.post("/admin/announcements", data);
  return response.data;
}

export async function listAnnouncements() {
  const response = await api.get("/admin/announcements");
  return response.data;
}

export async function deleteAnnouncement(id) {
  const response = await api.delete(`/admin/announcements/${id}`);
  return response.data;
}

export async function getPipelineHealth() {
  const response = await api.get("/admin/pipeline-health");
  return response.data;
}

export async function reprocessDocument(id) {
  const response = await api.post(`/admin/documents/${id}/reprocess`, {}, { timeout: 60000 });
  return response.data;
}
