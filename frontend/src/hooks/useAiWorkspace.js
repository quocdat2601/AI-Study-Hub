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
  getExtractionStatus,
  isPdfDocument,
  mapWorkspaceDocument,
  needsTextExtraction,
} from "../lib/workspaceUtils.js";

export default function useAiWorkspace() {
  const { user, logout, refreshUser } = useAuth();

  const [documents, setDocuments] = useState([]);
  const [bookmarkIds, setBookmarkIds] = useState(new Set());
  const [subjects, setSubjects] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("");

  const [selectedDocId, setSelectedDocId] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pdfError, setPdfError] = useState("");
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isPreparingText, setIsPreparingText] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState("");
  const [isAITyping, setIsAITyping] = useState(false);
  const [chatError, setChatError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);

  const reloadDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    setLoadError("");

    try {
      const [docs, bookmarks, subjectList] = await Promise.all([
        listDocuments(),
        listBookmarks().catch(() => []),
        listSubjects().catch(() => []),
      ]);

      const ids = new Set(
        (Array.isArray(bookmarks) ? bookmarks : [])
          .map((item) => Number(item.doc_id ?? item.docId))
          .filter(Boolean)
      );

      setDocuments(Array.isArray(docs) ? docs : docs?.documents || []);
      setBookmarkIds(ids);
      setSubjects(subjectList);
    } catch (err) {
      setLoadError(err.response?.data?.error || "Could not load documents");
      setDocuments([]);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    refreshUser?.().catch(() => {});
    // Chỉ load profile một lần khi mở workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reloadDocuments();
  }, [reloadDocuments]);

  const workspaceDocuments = useMemo(
    () => documents.map((doc) => mapWorkspaceDocument(doc, bookmarkIds, user?.id)),
    [documents, bookmarkIds, user?.id]
  );

  const filteredDocuments = useMemo(() => {
    let result = [...workspaceDocuments];

    if (activeTab === "recent") {
      result.sort((a, b) => {
        const aTime = new Date(a.raw.updated_at || a.raw.created_at).getTime();
        const bTime = new Date(b.raw.updated_at || b.raw.created_at).getTime();
        return bTime - aTime;
      });
    }

    if (activeTab === "bookmarked") {
      result = result.filter((doc) => doc.bookmarked);
    }

    if (activeTab === "shared") {
      result = result.filter((doc) => doc.isShared);
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((doc) => doc.title.toLowerCase().includes(term));
    }

    if (subjectFilter) {
      result = result.filter((doc) => String(doc.raw.subject_id) === String(subjectFilter));
    }

    if (fileTypeFilter) {
      result = result.filter((doc) => doc.type === fileTypeFilter);
    }

    return result;
  }, [workspaceDocuments, activeTab, search, subjectFilter, fileTypeFilter]);

  const selectedDocument = useMemo(
    () => workspaceDocuments.find((doc) => doc.id === selectedDocId) || null,
    [workspaceDocuments, selectedDocId]
  );

  const loadChatForDocument = useCallback(async (docId) => {
    setChatError("");
    setMessages([]);
    setSessionId(null);
    setIsLoadingChat(true);

    try {
      const session = await getOrCreateChatSession(docId);
      const payload = await getChatSessionMessages(session.id);
      setSessionId(session.id);
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    } catch (err) {
      setChatError(err.response?.data?.error || "Could not load chat session");
    } finally {
      setIsLoadingChat(false);
    }
  }, []);

  const prepareDocumentText = useCallback(async (doc) => {
    const status = getExtractionStatus(doc.raw);
    setExtractionStatus(status);

    if (!needsTextExtraction(doc.raw)) {
      return;
    }

    setIsPreparingText(true);

    try {
      const result = await reextractDocumentText(doc.id);
      const updatedDoc = result.document || {};
      const nextStatus = getExtractionStatus(updatedDoc);
      setExtractionStatus(nextStatus);

      setDocuments((current) =>
        current.map((item) =>
          String(item.id) === String(doc.id) ? { ...item, ...updatedDoc } : item
        )
      );
    } catch (err) {
      setExtractionStatus("failed");
      setChatError(err.response?.data?.error || "Could not prepare document text for AI");
    } finally {
      setIsPreparingText(false);
    }
  }, []);

  const loadPdfPreview = useCallback(async (docId, doc) => {
    if (!isPdfDocument(doc.raw)) {
      setPdfError("Inline preview is available for PDF files only.");
      return;
    }

    const cached = pdfCacheRef.current.get(docId);
    if (cached) {
      setPdfBytes(cached);
      setPdfError("");
      setIsLoadingPdf(false);
      return;
    }

    setIsLoadingPdf(true);

    try {
      const buffer = await getDocumentPreview(docId);
      const bytes = new Uint8Array(buffer.slice(0));
      pdfCacheRef.current.set(docId, bytes);
      setPdfBytes(bytes);
    } catch (err) {
      setPdfError(err.response?.data?.error || "Could not load document preview");
    } finally {
      setIsLoadingPdf(false);
    }
  }, []);

  const selectDocument = useCallback(
    async (docId) => {
      const doc = workspaceDocuments.find((item) => item.id === docId);
      if (!doc) return;

      setSelectedDocId(docId);
      setPdfBytes(null);
      setPdfError("");
      setChatError("");
      setCurrentPage(1);
      setTotalPages(1);
      setExtractionStatus(getExtractionStatus(doc.raw));

      // Tải song song — không chờ hết mới hiện UI (tránh lúc nhanh lúc chậm).
      void loadChatForDocument(docId);
      void prepareDocumentText(doc);
      void loadPdfPreview(docId, doc);
    },
    [workspaceDocuments, loadChatForDocument, prepareDocumentText, loadPdfPreview]
  );

  const initialSelectionDoneRef = useRef(false);
  const pdfCacheRef = useRef(new Map());

  useEffect(() => {
    if (initialSelectionDoneRef.current || isLoadingDocs || filteredDocuments.length === 0) return;
    initialSelectionDoneRef.current = true;
    selectDocument(filteredDocuments[0].id);
  }, [filteredDocuments, isLoadingDocs, selectDocument]);

  const toggleBookmark = useCallback(async (docId) => {
    const numericId = Number(docId);
    const isBookmarked = bookmarkIds.has(numericId);

    try {
      if (isBookmarked) {
        await removeBookmark(numericId);
        setBookmarkIds((current) => {
          const next = new Set(current);
          next.delete(numericId);
          return next;
        });
      } else {
        await addBookmark(numericId);
        setBookmarkIds((current) => new Set(current).add(numericId));
      }
    } catch {
      // Ignore bookmark errors in UI for now.
    }
  }, [bookmarkIds]);

  const sendMessage = useCallback(
    async (content) => {
      if (!sessionId || !content.trim()) return;

      setIsAITyping(true);
      setChatError("");

      const optimisticUser = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: content.trim(),
        created_at: new Date().toISOString(),
      };
      setMessages((current) => [...current, optimisticUser]);

      try {
        const result = await sendChatMessage(sessionId, content.trim());
        setMessages((current) => [
          ...current.filter((message) => message.id !== optimisticUser.id),
          result.userMessage,
          result.assistantMessage,
        ]);
      } catch (err) {
        setMessages((current) => current.filter((message) => message.id !== optimisticUser.id));
        setChatError(err.response?.data?.error || "Could not send message");
      } finally {
        setIsAITyping(false);
      }
    },
    [sessionId]
  );

  function clearFilters() {
    setSubjectFilter("");
    setFileTypeFilter("");
    setSearch("");
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
    reloadDocuments,
  };
}
