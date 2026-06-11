import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { addBookmark, listBookmarks, removeBookmark } from "../services/bookmarkApi.js";
import {
  getChatSessionMessages,
  getOrCreateChatSession,
  sendChatMessage,
} from "../services/chatApi.js";
import {
  getDocumentPreview,
  listDocuments,
  reextractDocumentText,
} from "../services/documentApi.js";
import { listSubjects } from "../services/subjectApi.js";
import {
  filterWorkspaceDocuments,
  getApiError,
  getExtractionStatus,
  isPdfDocument,
  mapWorkspaceDocument,
  needsTextExtraction,
} from "../lib/workspaceUtils.js";

/**
 * Hook chính của Workspace.
 * Quản lý: danh sách tài liệu, PDF, chat AI.
 */
export default function useWorkspace() {
  const { user, logout, refreshUser } = useAuth();

  // --- Sidebar: documents & filters ---
  const [documents, setDocuments] = useState([]);
  const [bookmarkIds, setBookmarkIds] = useState(new Set());
  const [subjects, setSubjects] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("");

  // --- Center: PDF viewer ---
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pdfError, setPdfError] = useState("");
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const pdfCacheRef = useRef(new Map());

  // --- Right: chat ---
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isPreparingText, setIsPreparingText] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState("");
  const [isAITyping, setIsAITyping] = useState(false);
  const [chatError, setChatError] = useState("");

  const initialSelectDone = useRef(false);

  // Load profile + document list khi mở trang
  useEffect(() => {
    refreshUser?.().catch(() => {});
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setIsLoadingDocs(true);
    setLoadError("");

    try {
      const [docs, bookmarks, subjectList] = await Promise.all([
        listDocuments(),
        listBookmarks().catch(() => []),
        listSubjects().catch(() => []),
      ]);

      const ids = new Set(
        (bookmarks || []).map((item) => Number(item.doc_id ?? item.docId)).filter(Boolean)
      );

      setDocuments(Array.isArray(docs) ? docs : docs?.documents || []);
      setBookmarkIds(ids);
      setSubjects(subjectList);
    } catch (err) {
      setLoadError(getApiError(err, "Could not load documents"));
      setDocuments([]);
    } finally {
      setIsLoadingDocs(false);
    }
  }

  const workspaceDocuments = useMemo(
    () => documents.map((doc) => mapWorkspaceDocument(doc, bookmarkIds, user?.id)),
    [documents, bookmarkIds, user?.id]
  );

  const filteredDocuments = useMemo(
    () => filterWorkspaceDocuments(workspaceDocuments, { activeTab, search, subjectFilter, fileTypeFilter }),
    [workspaceDocuments, activeTab, search, subjectFilter, fileTypeFilter]
  );

  const selectedDocument = useMemo(
    () => workspaceDocuments.find((doc) => doc.id === selectedDocId) || null,
    [workspaceDocuments, selectedDocId]
  );

  // Tự chọn tài liệu đầu tiên
  useEffect(() => {
    if (initialSelectDone.current || isLoadingDocs || filteredDocuments.length === 0) return;
    initialSelectDone.current = true;
    selectDocument(filteredDocuments[0].id);
  }, [filteredDocuments, isLoadingDocs]);

  async function loadChat(docId) {
    setChatError("");
    setMessages([]);
    setSessionId(null);
    setIsLoadingChat(true);

    try {
      const session = await getOrCreateChatSession(docId);
      const payload = await getChatSessionMessages(session.id);
      setSessionId(session.id);
      setMessages(payload.messages || []);
    } catch (err) {
      setChatError(getApiError(err, "Could not load chat session"));
    } finally {
      setIsLoadingChat(false);
    }
  }

  async function prepareText(doc) {
    const status = getExtractionStatus(doc.raw);
    setExtractionStatus(status);
    if (!needsTextExtraction(doc.raw)) return;

    setIsPreparingText(true);
    try {
      const result = await reextractDocumentText(doc.id);
      const updated = result.document || {};
      setExtractionStatus(getExtractionStatus(updated));
      setDocuments((list) =>
        list.map((item) => (String(item.id) === String(doc.id) ? { ...item, ...updated } : item))
      );
    } catch (err) {
      setExtractionStatus("failed");
      setChatError(getApiError(err, "Could not prepare document text for AI"));
    } finally {
      setIsPreparingText(false);
    }
  }

  async function loadPdf(docId, doc) {
    if (!isPdfDocument(doc.raw)) {
      setPdfError("Inline preview is available for PDF files only.");
      return;
    }

    const cached = pdfCacheRef.current.get(docId);
    if (cached) {
      setPdfBytes(cached);
      setPdfError("");
      return;
    }

    setIsLoadingPdf(true);
    try {
      const buffer = await getDocumentPreview(docId);
      const bytes = new Uint8Array(buffer);
      pdfCacheRef.current.set(docId, bytes);
      setPdfBytes(bytes);
      setPdfError("");
    } catch (err) {
      setPdfError(getApiError(err, "Could not load document preview"));
    } finally {
      setIsLoadingPdf(false);
    }
  }

  const selectDocument = useCallback(
    (docId) => {
      const doc = workspaceDocuments.find((item) => item.id === docId);
      if (!doc) return;

      setSelectedDocId(docId);
      setPdfBytes(null);
      setPdfError("");
      setChatError("");
      setCurrentPage(1);
      setTotalPages(1);
      setExtractionStatus(getExtractionStatus(doc.raw));

      loadChat(docId);
      prepareText(doc);
      loadPdf(docId, doc);
    },
    [workspaceDocuments]
  );

  async function toggleBookmark(docId) {
    const id = Number(docId);
    const isBookmarked = bookmarkIds.has(id);

    try {
      if (isBookmarked) {
        await removeBookmark(id);
        setBookmarkIds((ids) => {
          const next = new Set(ids);
          next.delete(id);
          return next;
        });
      } else {
        await addBookmark(id);
        setBookmarkIds((ids) => new Set(ids).add(id));
      }
    } catch {
      // Bỏ qua lỗi bookmark — không chặn UI
    }
  }

  async function sendMessage(content) {
    const text = content.trim();
    if (!sessionId || !text) return;

    setIsAITyping(true);
    setChatError("");

    const tempId = `temp-${Date.now()}`;
    setMessages((list) => [...list, { id: tempId, role: "user", content: text }]);

    try {
      const result = await sendChatMessage(sessionId, text);
      setMessages((list) => [
        ...list.filter((msg) => msg.id !== tempId),
        result.userMessage,
        result.assistantMessage,
      ]);
    } catch (err) {
      setMessages((list) => list.filter((msg) => msg.id !== tempId));
      setChatError(getApiError(err, "Could not send message"));
    } finally {
      setIsAITyping(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setSubjectFilter("");
    setFileTypeFilter("");
  }

  function changeZoom(delta) {
    setZoom((value) => Math.min(200, Math.max(50, value + delta)));
  }

  function goToPage(page) {
    setCurrentPage(Math.min(totalPages, Math.max(1, page)));
  }

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages || 1);
    }
  }, [currentPage, totalPages]);

  return {
    user,
    logout,
    subjects,
    isLoadingDocs,
    loadError,
    search,
    setSearch,
    activeTab,
    setActiveTab,
    subjectFilter,
    setSubjectFilter,
    fileTypeFilter,
    setFileTypeFilter,
    clearFilters,
    filteredDocuments,
    selectedDocId,
    selectedDocument,
    selectDocument,
    toggleBookmark,
    pdfBytes,
    pdfError,
    isLoadingPdf,
    currentPage,
    totalPages,
    setTotalPages,
    goToPage,
    zoom,
    changeZoom,
    messages,
    isLoadingChat,
    isPreparingText,
    extractionStatus,
    isAITyping,
    chatError,
    sendMessage,
    setPdfError,
    reloadDocuments: loadDocuments,
  };
}
