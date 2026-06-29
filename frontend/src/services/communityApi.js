import api from "./api.js";

export async function getCommunityHome(params = {}) {
  const response = await api.get("/public/community", { params });
  return response.data;
}

export async function getCommunityFeed(params = {}) {
  const response = await api.get("/public/community/feed", { params });
  return response.data;
}

export async function getUserCommunityProfile(userId) {
  const response = await api.get(`/public/community/users/${userId}`);
  return response.data;
}

export async function getCommunityPost(id) {
  const response = await api.get(`/public/community/posts/${id}`);
  return response.data;
}

export async function createCommunityPost(payload) {
  const response = await api.post("/community/posts", payload);
  return response.data;
}

export async function createCommunityReply(postId, payload) {
  const isStringPayload = typeof payload === "string";
  const body = isStringPayload
    ? payload
    : payload?.body ?? payload?.content ?? "";
  const parentReplyId = isStringPayload ? undefined : payload?.parentReplyId;

  const response = await api.post(`/community/posts/${postId}/replies`, {
    body,
    ...(parentReplyId ? { parentReplyId } : {}),
  });
  return response.data;
}

export async function deleteCommunityPost(postId) {
  const response = await api.delete(`/community/posts/${postId}`);
  return response.data;
}

export async function deleteCommunityReply(replyId) {
  const response = await api.delete(`/community/replies/${replyId}`);
  return response.data;
}

export async function editCommunityReply(replyId, body) {
  const response = await api.patch(`/community/replies/${replyId}`, { body });
  return response.data;
}

export async function toggleCommunityPostVote(postId) {
  const response = await api.post(`/community/posts/${postId}/vote`);
  return response.data;
}

export async function toggleCommunityReplyVote(replyId) {
  const response = await api.post(`/community/replies/${replyId}/vote`);
  return response.data;
}

export async function acceptCommunityReply(postId, replyId) {
  const response = await api.post(`/community/posts/${postId}/accept/${replyId}`);
  return response.data;
}

export async function reportCommunityPost(postId, payload) {
  const response = await api.post(`/community/posts/${postId}/report`, payload);
  return response.data;
}

export async function getCommunityPostDetail(postId) {
  return getCommunityPost(postId);
}

export async function uploadCommunityImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await api.post("/community/images", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function editCommunityPost(postId, payload) {
  const response = await api.patch(`/community/posts/${postId}`, payload);
  return response.data;
}
