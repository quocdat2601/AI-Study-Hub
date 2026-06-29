import api from "./api.js";

export async function listBookmarks() {
  const response = await api.get("/bookmarks");
  return response.data;
}

export async function addBookmark(docId) {
  const response = await api.post(`/bookmarks/${docId}`);
  return response.data;
}

export async function removeBookmark(docId) {
  const response = await api.delete(`/bookmarks/${docId}`);
  return response.data;
}
