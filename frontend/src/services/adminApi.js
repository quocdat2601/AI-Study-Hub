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
