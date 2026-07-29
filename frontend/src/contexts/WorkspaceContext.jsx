import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  addWorkspaceBookmark,
  fetchWorkspacePdf,
  getWorkspaceBootstrap,
  getWorkspaceDocumentContext,
  removeWorkspaceBookmark,
  sendWorkspaceMessage,
} from "../services/workspaceApi.js";
import { useAuth } from "./AuthContext.jsx";

const WorkspaceContext = createContext(null);

function formatDocDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mapDocument(doc) {
  const subjectCode = doc.subjects?.code || doc.subjects?.name || "DOC";
  const mimeType = doc.cloud_files?.mime_type || "";
  let fileType = "FILE";
  if (mimeType.includes("pdf")) {
    fileType = "PDF";
  } else if (mimeType.includes("word")) {
    fileType = "DOCX";
  } else if (mimeType.startsWith("image/")) {
    fileType = "IMAGE";
  }

  return {
    id: doc.id,
    title: doc.title,
    subject: subjectCode,
    date: formatDocDate(doc.updated_at || doc.created_at),
    type: fileType,
    mimeType,
    extractedText: doc.extracted_text || "",
    extractionStatus: doc.extraction_status,
    extractionError: doc.extraction_error || "",
    isPublic: Boolean(doc.is_public),
    userId: doc.user_id,
  };
}

export function WorkspaceProvider({ children }) {
  const { user, logout } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [rawDocuments, setRawDocuments] = useState([]);
  const [bookmarkedDocIds, setBookmarkedDocIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const pdfBlobUrlRef = useRef("");
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatHint, setChatHint] = useState("");
  const [documentDetails, setDocumentDetails] = useState({});
  const [viewMode, setViewMode] = useState("pdf");

  const documents = useMemo(() => rawDocuments.map(mapDocument), [rawDocuments]);

  const filteredDocuments = useMemo(() => {
    let list = [...documents];

    if (activeTab === "bookmarked") {
      list = list.filter((doc) => bookmarkedDocIds.has(doc.id));
    }

    if (activeTab === "recent") {
      list = list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }

    if (activeTab === "shared") {
      list = list.filter((doc) => userId && doc.userId !== userId);
    }

    if (fileTypeFilter === "PDF") {
      list = list.filter((doc) => doc.type === "PDF");
    }

    if (fileTypeFilter === "DOCX") {
      list = list.filter((doc) => doc.type === "DOCX");
    }

    return list;
  }, [documents, activeTab, bookmarkedDocIds, fileTypeFilter, userId]);

  const selectedDocument = useMemo(() => {
    const base = documents.find((doc) => doc.id === selectedDocId);
    if (!base) return null;
    const detail = documentDetails[selectedDocId];
    if (!detail) return base;
    return {
      ...base,
      extractedText: detail.extractedText ?? base.extractedText,
      extractionStatus: detail.extractionStatus ?? base.extractionStatus,
      extractionError: detail.extractionError ?? base.extractionError,
      extractionMetadata: detail.extractionMetadata ?? null,
    };
  }, [documents, selectedDocId, documentDetails]);


  const loadBootstrap = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const data = await getWorkspaceBootstrap({
        search: search.trim() || undefined,
        subjectId: subjectFilter || undefined,
      });
      setRawDocuments(data.documents || []);
      setSubjects(data.subjects || []);
      setBookmarkedDocIds(new Set(data.bookmarkedDocIds || []));
    } catch (err) {
      setRawDocuments([]);
      setSubjects([]);
      setBookmarkedDocIds(new Set());
      setLoadError(err.response?.data?.error || "Không tải được workspace.");
    } finally {
      setIsLoading(false);
    }
  }, [search, subjectFilter]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (!filteredDocuments.length) {
      setSelectedDocId(null);
      return;
    }

    if (!selectedDocId || !filteredDocuments.some((doc) => doc.id === selectedDocId)) {
      setSelectedDocId(filteredDocuments[0].id);
    }
  }, [filteredDocuments, selectedDocId]);

  const clearPdfBlob = useCallback(() => {
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current);
      pdfBlobUrlRef.current = "";
    }
    setPdfBlobUrl("");
  }, []);

  useEffect(() => () => {
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current);
    }
  }, []);

  const loadDocument = useCallback(async (docId) => {
    setIsPdfLoading(true);
    setIsChatLoading(true);
    setPdfUrl("");
    clearPdfBlob();
    setPdfLoadError("");
    setChatError("");
    setChatHint("");
    setMessages([]);
    setSessionId(null);
    setCurrentPage(1);
    setTotalPages(1);
    let fileMimeType = "application/pdf";

    try {
      const data = await getWorkspaceDocumentContext(docId);
      const doc = data.document || {};
      fileMimeType = doc.cloud_files?.mime_type || fileMimeType;

      setDocumentDetails((current) => ({
        ...current,
        [docId]: {
          extractedText: doc.extracted_text || "",
          extractionStatus: doc.extraction_status,
          extractionError: doc.extraction_error || "",
          extractionMetadata: doc.extraction_metadata || null,
        },
      }));


      setPdfUrl(data.signedUrl || "");
      setSessionId(data.sessionId || null);
      setMessages(data.messages || []);
      setChatHint(data.chatHint || "");
    } catch (err) {
      setPdfUrl("");
      setChatError(err.response?.data?.error || "Không tải được thông tin tài liệu.");
    } finally {
      setIsChatLoading(false);
    }

    try {
      const pdfBuffer = await fetchWorkspacePdf(docId);
      const blob = new Blob([new Uint8Array(pdfBuffer)], {
        type: fileMimeType || "application/octet-stream",
      });
      const blobUrl = URL.createObjectURL(blob);
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
      }
      pdfBlobUrlRef.current = blobUrl;
      setPdfBlobUrl(blobUrl);
    } catch (err) {
      clearPdfBlob();
      setPdfLoadError(err.response?.data?.error || "Không tải được file PDF.");
    } finally {
      setIsPdfLoading(false);
    }
  }, [clearPdfBlob]);

  useEffect(() => {
    if (!selectedDocId) return;
    loadDocument(selectedDocId);
  }, [selectedDocId, loadDocument]);

  function selectDocument(docId) {
    setSelectedDocId(docId);
    setCurrentPage(1);
    setZoom(100);
    setViewMode("pdf");
  }

  async function toggleBookmark(docId) {
    const wasBookmarked = bookmarkedDocIds.has(docId);
    setBookmarkedDocIds((current) => {
      const next = new Set(current);
      if (wasBookmarked) next.delete(docId);
      else next.add(docId);
      return next;
    });

    try {
      if (wasBookmarked) {
        await removeWorkspaceBookmark(docId);
      } else {
        await addWorkspaceBookmark(docId);
      }
    } catch {
      setBookmarkedDocIds((current) => {
        const next = new Set(current);
        if (wasBookmarked) next.add(docId);
        else next.delete(docId);
        return next;
      });
    }
  }

  function clearFilters() {
    setSearch("");
    setSubjectFilter("");
    setFileTypeFilter("");
    setActiveTab("all");
  }

  function changeZoom(delta) {
    setZoom((value) => Math.min(200, Math.max(50, value + delta)));
  }

  async function handleSendMessage(content) {
    if (!sessionId || !content.trim()) return;

    setIsSending(true);
    setChatError("");

    try {
      const result = await sendWorkspaceMessage(sessionId, content.trim());
      setMessages((current) => [
        ...current,
        result.userMessage,
        result.assistantMessage,
      ]);
    } catch (err) {
      setChatError(err.response?.data?.error || "Không gửi được tin nhắn.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const value = {
    user,
    search,
    setSearch,
    activeTab,
    setActiveTab,
    subjectFilter,
    setSubjectFilter,
    fileTypeFilter,
    setFileTypeFilter,
    subjects,
    documents: filteredDocuments,
    isLoading,
    loadError,
    reload: loadBootstrap,
    loadDocument,
    selectedDocument,
    selectedDocId,
    selectDocument,
    bookmarkedDocIds,
    toggleBookmark,
    clearFilters,
    currentPage,
    setCurrentPage,
    totalPages,
    setTotalPages,
    zoom,
    changeZoom,
    pdfUrl,
    pdfBlobUrl,
    isPdfLoading,
    pdfLoadError,
    messages,
    isChatLoading,
    isSending,
    chatError,
    chatHint,
    handleSendMessage,
    handleLogout,
    viewMode,
    setViewMode,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return context;
}
