import api from "./api.js";

export async function getCommunityHome(params = {}) {
  const response = await api.get("/public/community", { params });
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

export async function createCommunityReply(postId, body) {
  const response = await api.post(`/community/posts/${postId}/replies`, { body });
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
