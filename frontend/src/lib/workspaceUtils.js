const SUBJECT_COLORS = {
  CS301: "#3b6fd4",
  CS202: "#7c4dbd",
  CS302: "#2d9e6b",
};

export function getSubjectColor(code) {
  const key = String(code || "").toUpperCase();
  return SUBJECT_COLORS[key] || "#5b6af8";
}

export function formatWorkspaceDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getFileTypeLabel(mimeType) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType?.includes("wordprocessingml")) return "DOCX";
  return "FILE";
}

export function isPdfDocument(doc) {
  return doc?.cloud_files?.mime_type === "application/pdf";
}

export function getExtractionStatus(doc) {
  return doc?.extraction_status || doc?.extractionStatus || "pending";
}

/** Chỉ gọi reextract khi backend chưa xử lý xong. */
export function needsTextExtraction(doc) {
  return getExtractionStatus(doc) === "pending";
}

export function mapWorkspaceDocument(doc, bookmarkIds, userId) {
  const mimeType = doc.cloud_files?.mime_type || "";

  return {
    id: String(doc.id),
    title: doc.title || "Untitled document",
    subject: doc.subjects?.code || doc.subjects?.name || "OTHER",
    date: formatWorkspaceDate(doc.updated_at || doc.created_at),
    type: getFileTypeLabel(mimeType),
    mimeType,
    bookmarked: bookmarkIds.has(Number(doc.id)),
    isShared: String(doc.user_id) !== String(userId),
    raw: doc,
  };
}

/** Lọc danh sách tài liệu theo tab, search, filter. */
export function filterWorkspaceDocuments(docs, filters) {
  const { activeTab, search, subjectFilter, fileTypeFilter } = filters;
  let list = [...docs];

  if (activeTab === "recent") {
    list.sort((a, b) => {
      const timeA = new Date(a.raw.updated_at || a.raw.created_at).getTime();
      const timeB = new Date(b.raw.updated_at || b.raw.created_at).getTime();
      return timeB - timeA;
    });
  }

  if (activeTab === "bookmarked") {
    list = list.filter((doc) => doc.bookmarked);
  }

  if (activeTab === "shared") {
    list = list.filter((doc) => doc.isShared);
  }

  const keyword = search.trim().toLowerCase();
  if (keyword) {
    list = list.filter((doc) => doc.title.toLowerCase().includes(keyword));
  }

  if (subjectFilter) {
    list = list.filter((doc) => String(doc.raw.subject_id) === String(subjectFilter));
  }

  if (fileTypeFilter) {
    list = list.filter((doc) => doc.type === fileTypeFilter);
  }

  return list;
}

/** Thông báo trạng thái hiển thị trong panel chat. */
export function getChatStatusMessage({ isLoadingChat, isPreparingText, extractionStatus }) {
  if (isLoadingChat) return "Loading chat session...";
  if (isPreparingText) return "Preparing document text for AI...";
  if (extractionStatus === "empty") return "Scanned PDF — no readable text for AI.";
  if (extractionStatus === "failed") return "Text extraction failed. You can still view the file.";
  if (extractionStatus === "pending") return "Document is still processing...";
  return "";
}

export function getApiError(err, fallback) {
  return err?.response?.data?.error || fallback;
}
