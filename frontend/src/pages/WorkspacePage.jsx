import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { askDocument, askDocumentStream, askSession, askSessionStream, getAiModelStatus, getAiUsage, processDocumentForAi } from "../services/aiApi.js";
import AIChatPanel from "../components/workspace/AIChatPanel.jsx";
import WorkspaceStudioPanel from "../components/workspace/WorkspaceStudioPanel.jsx";
import DocumentSidebar from "../components/workspace/DocumentSidebar.jsx";
import DocumentViewer from "../components/workspace/DocumentViewer.jsx";
import WorkspaceResizeHandle from "../components/workspace/WorkspaceResizeHandle.jsx";
import useWorkspaceLayout from "../hooks/useWorkspaceLayout.js";
import useChatAttachmentQueue from "../hooks/useChatAttachmentQueue.js";
import useUploadDoc from "../hooks/useUploadDoc.js";
import {
  attachChatDocument,
  createChatSession,
  deleteChatSession,
  detachChatDocument,
  getChatSessionMessages,
  getOrCreateDocumentChatSession,
  listChatSessions,
  listSharedDocuments as listSharedWorkspaceDocuments,
  permanentlyRemoveRecoverableChatDocument,
  permanentlyRemoveRecoverableChatDocuments,
  renameChatSession,
  removeTemporaryChatDocuments,
  restoreChatDocument,
  saveChatDocumentToLibrary,
  uploadChatDocument,
} from "../services/chatApi.js";
import { listDocuments, getDocumentSignedUrl } from "../services/documentApi.js";
import { isUploadDocTimeoutError, validateUploadDocFile } from "../services/uploadDocApi.js";
import { fetchWorkspacePdf } from "../services/workspaceApi.js";
import {
  cacheDocumentChat,
  cacheSessionMessages,
  cacheWorkspaceState,
  getCachedDocumentChat,
  getCachedSessionMessages,
  getWorkspaceCache,
  removeCachedSession,
} from "../utils/workspaceCache.js";
import {
  hasAssistantAfterUser,
  mergeAuthoritativeHistory,
  mergeMessagesById,
  mergePendingHistory,
  reconcilePersistedAsk,
} from "../utils/chatMessages.js";
import { normalizeAttachmentPayload } from "../utils/chatAttachments.js";

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
  "gemini-3.5-flash",
];
const DEFAULT_OLLAMA_MODELS = [
  "qwen2.5:3b",
];
const DEFAULT_MODELS = [...DEFAULT_GEMINI_MODELS, ...DEFAULT_OLLAMA_MODELS];
const MAX_CHAT_ATTACHMENTS = 20;
const snapshotSharingEnabled = String(import.meta.env.VITE_CHAT_SNAPSHOT_SHARING_ENABLED || "false") === "true";
const dragDropAttachmentsEnabled = String(import.meta.env.VITE_CHAT_DRAG_DROP_ATTACHMENTS_ENABLED || "false") === "true";

async function loadWorkspaceDocuments() {
  const [libraryDocuments, sharedPayload] = await Promise.all([
    listDocuments(),
    snapshotSharingEnabled ? listSharedWorkspaceDocuments() : Promise.resolve({ documents: [] }),
  ]);
  const byId = new Map([...(libraryDocuments || []), ...(sharedPayload.documents || [])].map((document) => [Number(document.id), document]));
  return [...byId.values()];
}

function buildUserMessage(content) {
  return {
    id: `user-${Date.now()}`,
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };
}

function buildAssistantMessage(data) {
  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    content: data.answer,
    sources: data.sources || [],
    mode: data.mode || "hybrid",
    provider: data.provider || "system",
    model: data.model,
    usedRag: Boolean(data.usedRag),
    needsProcessing: Boolean(data.needsProcessing),
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
  };
}

function stripStudioMetaFromDisplay(text) {
  return String(text || "")
    .replace(/\n*\[(?:studio-quiz-meta|studio-flashcard-meta)\][\s\S]*$/i, "")
    .trim();
}

function mapStoredMessage(message) {
  const metadata = message.metadata || {};
  const rawContent = message.role === "user"
    ? stripStudioMetaFromDisplay(message.content)
    : message.content;
  return {
    id: message.id || `${message.role}-${message.created_at}`,
    role: message.role,
    content: rawContent,
    createdAt: message.created_at || message.createdAt || null,
    sources: metadata.sources || [],
    mode: metadata.mode || "stored",
    provider: metadata.provider,
    model: metadata.model,
    usedRag: Boolean(metadata.usedRag),
    needsProcessing: Boolean(metadata.needsProcessing),
  };
}

function findLatestMessageModel(messages) {
  return [...(messages || [])]
    .reverse()
    .find((message) => message.role === "assistant" && message.model)?.model || "";
}

function sessionSummaryFromPayload(payload) {
  const session = payload?.session || {};
  return {
    id: session.id,
    title: session.title || "New chat",
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastActivityAt: session.lastActivityAt,
    primaryDocumentId: Number(session.primaryDocumentId),
    attachmentCount: payload?.documents?.length || 0,
    documentIds: (payload?.documents || []).map((document) => Number(document.id)),
  };
}

function getDocumentType(document) {
  const mime = document?.cloud_files?.mime_type || document?.mime_type || "";
  const title = document?.title || document?.name || "";
  if (mime.includes("pdf") || title.toLowerCase().endsWith(".pdf")) return "PDF";
  if (mime.includes("word") || title.toLowerCase().endsWith(".docx")) return "DOCX";
  return document?.file_type || document?.type || "DOC";
}

// =========================================================================
// SECTION 2: WORKSPACE PAGE COMPONENT
// Root workspace orchestration component managing documents sidebars,
// resizers, PDF viewers, RAG session configurations, and the Studio tab.
// =========================================================================

/**
 * WorkspacePage root component.
 * Synchronizes selected document route parameters, manages chat history loads,
 * SSE chunking updates, drag-and-drop attachments, and tabs toggle hooks.
 */
export default function WorkspacePage() {
  const { documentId: urlDocumentId } = useParams();
  const navigate = useNavigate();
  const cachedWorkspace = getWorkspaceCache();
  
  const selectedId = urlDocumentId ? Number(urlDocumentId) : null;
  const initialChat = getCachedDocumentChat(selectedId || cachedWorkspace.selectedId || cachedWorkspace.documents?.[0]?.id || null);
  const chatScrollRef = useRef(null);
  const prevUrlSelectedIdRef = useRef(selectedId);
  const lastSelectedIdRef = useRef(selectedId);
  const previousMessageCountRef = useRef(initialChat.messages.length);
  const pdfBlobUrlRef = useRef(null);
  const pdfPreviewRequestRef = useRef(0);
  const sessionIdRef = useRef(initialChat.sessionId);
  const chatHistoryRequestRef = useRef(0);
  const chatHistoryAbortRef = useRef(null);
  const sessionListRequestRef = useRef(0);
  const sessionListAbortRef = useRef(null);
  const sessionMutationAbortRef = useRef(null);
  const attachmentRequestAbortRef = useRef(null);
  const attachmentUploadAbortRef = useRef(null);
  const streamAbortRef = useRef(null);
  const askRequestRef = useRef(0);
  const pendingResponsesRef = useRef(new Map());
  const sessionRevalidationTimersRef = useRef(new Map());
  const [rightActiveTab, setRightActiveTab] = useState("chat"); // chat, studio
  const {
    sidebarWidth,
    chatWidth,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    onResizeSidebar,
    onResizeChat,
  } = useWorkspaceLayout();

  const [documents, setDocuments] = useState(() => cachedWorkspace.documents || []);
  const [messages, setMessages] = useState(() => initialChat.messages);
  const [sessionId, setSessionId] = useState(() => initialChat.sessionId);
  const [sessions, setSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [sessionAction, setSessionAction] = useState(null);
  const [question, setQuestion] = useState("");
  const [answerMode, setAnswerMode] = useState(() => cachedWorkspace.answerMode || "hybrid");
  const [selectedModel, setSelectedModel] = useState(() => initialChat.selectedModel || cachedWorkspace.selectedModel || "");
  const [availableModels, setAvailableModels] = useState(() => cachedWorkspace.availableModels || DEFAULT_MODELS);
  const [modelStatus, setModelStatus] = useState(() => cachedWorkspace.modelStatus || null);
  const [usage, setUsage] = useState(() => cachedWorkspace.usage || null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(() => !cachedWorkspace.documents?.length);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [recoverableAttachmentsBySession, setRecoverableAttachmentsBySession] = useState({});
  const [attachmentAction, setAttachmentAction] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState(0);
  const [processResult, setProcessResult] = useState(() => initialChat.processResult);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState("pdf");
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState("");
  const [docxSignedUrl, setDocxSignedUrl] = useState("");
  const [chatCollapsed, setChatCollapsed] = useState(false);


  const selectedDocument = useMemo(
    () => documents.find((doc) => Number(doc.id) === Number(selectedId)) || null,
    [documents, selectedId]
  );
  const handleWorkspaceUploaded = useCallback(async (result) => {
    const nextDocuments = await loadWorkspaceDocuments();
    setDocuments(nextDocuments || []);
    cacheWorkspaceState({ documents: nextDocuments || [] });

    const uploadedId = result?.document?.id || result?.id;
    if (uploadedId) {
      cacheWorkspaceState({ selectedId: uploadedId });
      navigate(`/workspace/documents/${uploadedId}`);
    }
  }, [navigate]);
  const uploadDoc = useUploadDoc({ onUploaded: handleWorkspaceUploaded });
  const geminiModels = modelStatus?.gemini?.models || availableModels.filter((model) => model.startsWith("gemini-"));
  const ollamaModels = modelStatus?.ollama?.allowedModels || availableModels.filter((model) => model.startsWith("qwen"));
  const isOllamaModel = (selectedModel || usage?.model || "").startsWith("qwen") || usage?.provider === "ollama";
  const recoverableAttachments = recoverableAttachmentsBySession[String(sessionId || "")] || [];
  const attachmentQueue = useChatAttachmentQueue({
    enabled: dragDropAttachmentsEnabled,
    sessionId,
    activeCount: attachments.length,
    maxDocuments: MAX_CHAT_ATTACHMENTS,
    onPayload: applyAttachmentPayload,
    onError: (queueError) => setAttachmentError(attachmentFailureMessage(queueError, "Could not upload this file.")),
  });

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const clearPdfBlob = useCallback(() => {
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current);
      pdfBlobUrlRef.current = null;
    }
    setPdfBlobUrl(null);
  }, []);

  const loadPdfPreview = useCallback(async (docId) => {
    if (!docId) return;
    const requestId = ++pdfPreviewRequestRef.current;
    try {
      setIsPdfLoading(true);
      setPdfLoadError("");
      const data = await fetchWorkspacePdf(docId);
      if (requestId !== pdfPreviewRequestRef.current) return;
      clearPdfBlob();
      const blob = new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      pdfBlobUrlRef.current = url;
      setPdfBlobUrl(url);
    } catch (err) {
      if (requestId !== pdfPreviewRequestRef.current) return;
      clearPdfBlob();
      setPdfLoadError(err.response?.data?.error || "Could not load PDF preview");
    } finally {
      if (requestId === pdfPreviewRequestRef.current) {
        setIsPdfLoading(false);
      }
    }
  }, [clearPdfBlob]);

  useEffect(() => () => {
    pdfPreviewRequestRef.current += 1;
    clearPdfBlob();
  }, [clearPdfBlob]);

  useEffect(() => {
    setCurrentPage(1);
    setTotalPages(1);
    setPdfLoadError("");
    setDocxSignedUrl("");

    if (!selectedDocument) {
      pdfPreviewRequestRef.current += 1;
      clearPdfBlob();
      return;
    }

    const type = getDocumentType(selectedDocument);
    if (type === "DOCX") {
      pdfPreviewRequestRef.current += 1;
      clearPdfBlob();
      setViewMode("pdf");

      setIsPdfLoading(true);
      getDocumentSignedUrl(selectedDocument.id)
        .then((data) => {
          setDocxSignedUrl(data.signedUrl);
        })
        .catch((err) => {
          setPdfLoadError(err.response?.data?.error || "Could not load document preview");
        })
        .finally(() => {
          setIsPdfLoading(false);
        });
      return;
    }

    if (type !== "PDF") {
      pdfPreviewRequestRef.current += 1;
      clearPdfBlob();
      setViewMode("text");
      return;
    }

    setViewMode((current) => current || "pdf");
    loadPdfPreview(selectedDocument.id);
  }, [clearPdfBlob, loadPdfPreview, selectedDocument]);

  function changeZoom(delta) {
    setZoom((current) => Math.min(160, Math.max(70, current + delta)));
  }

  useEffect(() => {
    let isMounted = true;

    async function loadDocuments() {
      try {
        if (!getWorkspaceCache().documents?.length) {
          setIsLoadingDocs(true);
        }
        setError("");
        const data = await loadWorkspaceDocuments();
        if (!isMounted) return;
        const nextDocuments = data || [];
        cacheWorkspaceState({ documents: nextDocuments });
        setDocuments(nextDocuments);
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || "Could not load documents");
        }
      } finally {
        if (isMounted) setIsLoadingDocs(false);
      }
    }

    loadDocuments();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoadingDocs) return;
    if (documents.length > 0 && selectedId !== null) {
      const isValid = documents.some((doc) => Number(doc.id) === selectedId);
      if (!isValid) {
        const cachedSelected = getWorkspaceCache().selectedId;
        const validId = [cachedSelected, documents[0]?.id]
          .find((candidate) => candidate && documents.some((doc) => Number(doc.id) === Number(candidate))) || null;
        if (validId) {
          navigate(`/workspace/documents/${validId}`, { replace: true });
        } else {
          navigate(`/workspace`, { replace: true });
        }
      } else {
        cacheWorkspaceState({ selectedId });
      }
    } else if (documents.length > 0 && selectedId === null) {
      const cachedSelected = getWorkspaceCache().selectedId;
      const validId = [cachedSelected, documents[0]?.id]
        .find((candidate) => candidate && documents.some((doc) => Number(doc.id) === Number(candidate))) || null;
      if (validId) {
        navigate(`/workspace/documents/${validId}`, { replace: true });
      }
    } else if (documents.length === 0 && selectedId !== null) {
      navigate(`/workspace`, { replace: true });
    }
  }, [documents, selectedId, isLoadingDocs, navigate]);



  function publishSessionMessages(targetSessionId, targetDocumentId, nextMessages) {
    cacheSessionMessages(targetSessionId, nextMessages);
    if (
      Number(sessionIdRef.current) === Number(targetSessionId)
      && String(getWorkspaceCache().selectedId || "") === String(targetDocumentId || "")
    ) {
      setMessages(nextMessages);
    }
  }

  function clearPendingResponse(targetSessionId) {
    pendingResponsesRef.current.delete(String(targetSessionId));
    const timer = sessionRevalidationTimersRef.current.get(String(targetSessionId));
    if (timer) clearTimeout(timer);
    sessionRevalidationTimersRef.current.delete(String(targetSessionId));
  }

  function scheduleSessionRevalidation(targetSessionId, targetDocumentId, attempt = 0) {
    const key = String(targetSessionId);
    const delays = [1500, 3000, 5000, 10000, 20000, 30000];
    const delay = delays[Math.min(attempt, delays.length - 1)];
    const currentTimer = sessionRevalidationTimersRef.current.get(key);
    if (currentTimer) clearTimeout(currentTimer);

    const timer = setTimeout(async () => {
      const pending = pendingResponsesRef.current.get(key);
      if (!pending) return;
      try {
        const payload = await getChatSessionMessages(targetSessionId);
        if (Number(payload?.session?.primaryDocumentId) !== Number(targetDocumentId)) return;
        const cachedMessages = getCachedSessionMessages(targetSessionId);
        const authoritative = mergeMessagesById([], (payload.messages || []).map(mapStoredMessage));
        const monotonicHistory = mergeAuthoritativeHistory(authoritative, cachedMessages);
        const activePending = pendingResponsesRef.current.get(key);
        if (!activePending) {
          publishSessionMessages(targetSessionId, targetDocumentId, monotonicHistory);
          return;
        }
        const completed = hasAssistantAfterUser(monotonicHistory, activePending.userContent);
        const nextMessages = completed
          ? monotonicHistory
          : mergePendingHistory(monotonicHistory, cachedMessages, activePending.userContent);
        publishSessionMessages(targetSessionId, targetDocumentId, nextMessages);
        if (completed) {
          clearPendingResponse(targetSessionId);
          return;
        }
      } catch {
        // A later retry handles transient history failures while generation continues.
      }
      if (pendingResponsesRef.current.has(key) && attempt < 20) {
        scheduleSessionRevalidation(targetSessionId, targetDocumentId, attempt + 1);
      }
    }, delay);
    sessionRevalidationTimersRef.current.set(key, timer);
  }

  useEffect(() => () => {
    for (const timer of sessionRevalidationTimersRef.current.values()) clearTimeout(timer);
    sessionRevalidationTimersRef.current.clear();
  }, []);

  const cancelActiveChatWork = useCallback(() => {
    askRequestRef.current += 1;
    chatHistoryRequestRef.current += 1;
    chatHistoryAbortRef.current?.abort();
    chatHistoryAbortRef.current = null;
    sessionListRequestRef.current += 1;
    sessionListAbortRef.current?.abort();
    sessionListAbortRef.current = null;
    sessionMutationAbortRef.current?.abort();
    sessionMutationAbortRef.current = null;
    setSessionAction(null);
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    attachmentUploadAbortRef.current?.abort();
    attachmentUploadAbortRef.current = null;
    attachmentRequestAbortRef.current?.abort();
    attachmentRequestAbortRef.current = null;
    setAttachmentAction(null);
    setAttachmentUploadProgress(0);
    setIsAsking(false);
  }, []);

  useEffect(() => {
    if (selectedId && prevUrlSelectedIdRef.current !== selectedId) {
      prevUrlSelectedIdRef.current = selectedId;
      const cachedChat = getCachedDocumentChat(selectedId);
      cancelActiveChatWork();
      setSessions([]);
      sessionIdRef.current = cachedChat.sessionId;
      setSessionId(cachedChat.sessionId);
      setMessages(cachedChat.messages);
      setAttachments([]);
      setAttachmentAction(null);
      setAttachmentError("");
      setAttachmentUploadProgress(0);
      if (cachedChat.selectedModel) {
        setSelectedModel(cachedChat.selectedModel);
      }
      setQuestion("");
      setError("");
    }
  }, [selectedId, cancelActiveChatWork]);

  const loadChatHistory = useCallback(async (docId, options = {}) => {
    const { showLoader = true, sessionId: requestedSessionId } = options;
    const requestId = ++chatHistoryRequestRef.current;
    chatHistoryAbortRef.current?.abort();
    const controller = new AbortController();
    chatHistoryAbortRef.current = controller;
    try {
      if (showLoader) setIsLoadingMessages(true);
      setError("");
      const session = requestedSessionId
        ? { id: requestedSessionId }
        : await getOrCreateDocumentChatSession(docId, { signal: controller.signal });
      if (!requestedSessionId) {
        sessionIdRef.current = session.id;
        setSessionId(session.id);
        cacheDocumentChat(docId, { sessionId: session.id });
      }
      const payload = await getChatSessionMessages(session.id, { signal: controller.signal });
      if (requestId !== chatHistoryRequestRef.current) return;
      if (Number(payload?.session?.primaryDocumentId) !== Number(docId)) {
        throw new Error("Chat session does not belong to the opened document");
      }

      const authoritativeMessages = mergeMessagesById(
        [],
        (payload.messages || []).map(mapStoredMessage)
      );
      const cachedSessionMessages = getCachedSessionMessages(session.id);
      const monotonicHistory = mergeAuthoritativeHistory(
        authoritativeMessages,
        cachedSessionMessages
      );
      const pending = pendingResponsesRef.current.get(String(session.id));
      const pendingCompleted = pending
        ? hasAssistantAfterUser(monotonicHistory, pending.userContent)
        : false;
      const nextMessages = pending && !pendingCompleted
        ? mergePendingHistory(
          monotonicHistory,
          cachedSessionMessages,
          pending.userContent
        )
        : monotonicHistory;
      if (pendingCompleted) clearPendingResponse(session.id);
      const {
        activeAttachments: nextAttachments,
        recoverableAttachments: nextRecoverableAttachments,
      } = normalizeAttachmentPayload(payload);
      const restoredModel = findLatestMessageModel(nextMessages);
      cacheDocumentChat(docId, {
        sessionId: session.id,
        selectedModel: restoredModel || getCachedDocumentChat(docId).selectedModel,
      });
      cacheSessionMessages(session.id, nextMessages);
      if (String(getWorkspaceCache().selectedId || "") !== String(docId || "")) return;
      if (Number(sessionIdRef.current) !== Number(session.id)) return;

      sessionIdRef.current = session.id;
      setSessionId(session.id);
      setMessages(nextMessages);
      setAttachments(nextAttachments);
      setRecoverableAttachmentsBySession((current) => ({
        ...current,
        [String(session.id)]: nextRecoverableAttachments,
      }));
      if (restoredModel) {
        setSelectedModel(restoredModel);
        cacheWorkspaceState({ selectedModel: restoredModel });
      }
      return payload;
    } catch (err) {
      if (err.code === "ERR_CANCELED") return null;
      if (requestId !== chatHistoryRequestRef.current) return;
      if (String(getWorkspaceCache().selectedId || "") !== String(docId || "")) return;
      if (Number(sessionIdRef.current) !== Number(requestedSessionId || sessionIdRef.current)) return;
      sessionIdRef.current = null;
      setSessionId(null);
      setAttachments([]);
      cacheDocumentChat(docId, { sessionId: null });
      if (showLoader) setMessages([]);
      setError(err.response?.data?.error || "Could not load chat history");
      return null;
    } finally {
      if (requestId === chatHistoryRequestRef.current) {
        setIsLoadingMessages(false);
      }
      if (chatHistoryAbortRef.current === controller) chatHistoryAbortRef.current = null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadModelStatus() {
      try {
        const status = await getAiModelStatus();
        if (!isMounted) return;
        setModelStatus(status);
        const geminiModels = status.gemini?.models || DEFAULT_GEMINI_MODELS;
        const ollamaModels = status.ollama?.allowedModels || DEFAULT_OLLAMA_MODELS;
        const nextModels = [...geminiModels, ...ollamaModels];
        cacheWorkspaceState({ availableModels: nextModels, modelStatus: status });
        setAvailableModels(nextModels);
        setSelectedModel((current) => {
          const cachedDocumentModel = getCachedDocumentChat(getWorkspaceCache().selectedId).selectedModel;
          const nextModel = current || cachedDocumentModel || getWorkspaceCache().selectedModel || status.defaultModel || "gemini-2.5-flash";
          cacheWorkspaceState({ selectedModel: nextModel });
          return nextModel;
        });
      } catch {
        if (isMounted) {
          setAvailableModels(DEFAULT_MODELS);
          cacheWorkspaceState({ availableModels: DEFAULT_MODELS });
          setSelectedModel((current) => {
            const cachedDocumentModel = getCachedDocumentChat(getWorkspaceCache().selectedId).selectedModel;
            const nextModel = current || cachedDocumentModel || getWorkspaceCache().selectedModel || "gemini-2.5-flash";
            cacheWorkspaceState({ selectedModel: nextModel });
            return nextModel;
          });
        }
      }
    }

    loadModelStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const initializeChatSessions = useCallback(async (docId) => {
    cancelActiveChatWork();
    const requestId = ++sessionListRequestRef.current;
    const controller = new AbortController();
    sessionListAbortRef.current = controller;
    const cachedChat = getCachedDocumentChat(docId);
    try {
      setIsLoadingSessions(true);
      setSessionError("");
      setSessions([]);
      let result = await listChatSessions(docId, { signal: controller.signal });
      if (requestId !== sessionListRequestRef.current) return;
      let nextSessions = (result.sessions || []).filter((session) => (
        Number(session.primaryDocumentId) === Number(docId)
      ));
      let targetSession = nextSessions.find((session) => (
        Number(session.id) === Number(cachedChat.sessionId)
      ));
      if (!targetSession && nextSessions.length) targetSession = nextSessions[0];

      if (!targetSession) {
        const legacySession = await getOrCreateDocumentChatSession(docId, { signal: controller.signal });
        if (requestId !== sessionListRequestRef.current) return;
        result = await listChatSessions(docId, { signal: controller.signal });
        if (requestId !== sessionListRequestRef.current) return;
        nextSessions = (result.sessions || []).filter((session) => (
          Number(session.primaryDocumentId) === Number(docId)
        ));
        targetSession = nextSessions.find((session) => Number(session.id) === Number(legacySession.id));
      }
      if (String(getWorkspaceCache().selectedId || "") !== String(docId || "")) return;

      setSessions(nextSessions);
      if (!targetSession) {
        sessionIdRef.current = null;
        setSessionId(null);
        setMessages([]);
        setAttachments([]);
        return;
      }

      sessionIdRef.current = targetSession.id;
      setSessionId(targetSession.id);
      cacheDocumentChat(docId, { sessionId: targetSession.id });
      const canUseCachedMessages = Number(cachedChat.sessionId) === Number(targetSession.id)
        && cachedChat.messages.length;
      setMessages(canUseCachedMessages ? cachedChat.messages : []);
      setAttachments([]);
      await loadChatHistory(docId, {
        sessionId: targetSession.id,
        showLoader: !canUseCachedMessages,
      });
    } catch (err) {
      if (err.code === "ERR_CANCELED" || requestId !== sessionListRequestRef.current) return;
      if (String(getWorkspaceCache().selectedId || "") !== String(docId || "")) return;
      setSessionError(err.response?.data?.error || "Could not load chat sessions");
      setSessions([]);
      sessionIdRef.current = null;
      setSessionId(null);
      setMessages([]);
      setAttachments([]);
    } finally {
      if (
        requestId === sessionListRequestRef.current
        && String(getWorkspaceCache().selectedId || "") === String(docId || "")
      ) {
        setIsLoadingSessions(false);
      }
      if (sessionListAbortRef.current === controller) sessionListAbortRef.current = null;
    }
  }, [cancelActiveChatWork, loadChatHistory]);

  useEffect(() => {
    if (selectedId) {
      cacheWorkspaceState({ selectedId });
      setProcessResult(getCachedDocumentChat(selectedId).processResult);
      initializeChatSessions(selectedId);
    }
  }, [initializeChatSessions, selectedId]);

  useEffect(() => {
    const node = chatScrollRef.current;
    if (!node || !selectedId) return undefined;

    const cachedChat = getCachedDocumentChat(selectedId);
    window.requestAnimationFrame(() => {
      if (Number.isFinite(cachedChat.scrollTop)) {
        node.scrollTop = cachedChat.scrollTop;
      } else {
        node.scrollTop = node.scrollHeight;
      }
    });

    return undefined;
  }, [selectedId]);

  useEffect(() => {
    const node = chatScrollRef.current;
    if (!node) return;

    const selectedChanged = String(lastSelectedIdRef.current || "") !== String(selectedId || "");
    const messageCountIncreased = messages.length > previousMessageCountRef.current;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const wasNearBottom = distanceFromBottom < 160;

    window.requestAnimationFrame(() => {
      const cachedChat = getCachedDocumentChat(selectedId);
      if (selectedChanged && Number.isFinite(cachedChat.scrollTop)) {
        node.scrollTop = cachedChat.scrollTop;
      } else if (selectedChanged || messageCountIncreased || isAsking || wasNearBottom) {
        node.scrollTop = node.scrollHeight;
      }
    });

    lastSelectedIdRef.current = selectedId;
    previousMessageCountRef.current = messages.length;
  }, [messages.length, selectedId, isAsking]);

  const refreshUsage = useCallback(async (model) => {
    const requestedModel = model || getWorkspaceCache().selectedModel || undefined;
    try {
      setIsLoadingUsage(true);
      const data = await getAiUsage(requestedModel);
      cacheWorkspaceState({ usage: data });
      setUsage(data);
      if (data.allowedModels?.length) {
        cacheWorkspaceState({ availableModels: data.allowedModels });
        setAvailableModels(data.allowedModels);
      }
      if (data.provider === "ollama") {
        const status = await getAiModelStatus().catch(() => null);
        if (status) {
          cacheWorkspaceState({ modelStatus: status });
          setModelStatus(status);
        }
      }
      if (data.model && data.model !== requestedModel) {
        cacheWorkspaceState({ selectedModel: data.model });
        setSelectedModel(data.model);
      }
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Could not load AI usage");
      return null;
    } finally {
      setIsLoadingUsage(false);
    }
  }, []);

  useEffect(() => {
    if (selectedModel) {
      cacheWorkspaceState({ selectedModel });
      if (selectedId) {
        cacheDocumentChat(selectedId, { selectedModel });
      }
      refreshUsage(selectedModel);
    }
  }, [refreshUsage, selectedModel, selectedId]);

  useEffect(() => {
    cacheWorkspaceState({ answerMode });
  }, [answerMode]);

  function selectDocument(docId) {
    if (Number(docId) === Number(selectedId)) return;
    navigate(`/workspace/documents/${docId}`);
  }

  function applySelectedSessionPayload(payload, docId = selectedId) {
    const payloadSessionId = payload?.session?.id;
    if (!payloadSessionId || Number(sessionIdRef.current) !== Number(payloadSessionId)) return false;
    if (Number(payload?.session?.primaryDocumentId) !== Number(docId)) return false;
    const nextMessages = (payload.messages || []).map(mapStoredMessage);
    const {
      activeAttachments: nextAttachments,
      recoverableAttachments: nextRecoverableAttachments,
    } = normalizeAttachmentPayload(payload);
    const restoredModel = findLatestMessageModel(nextMessages);
    setMessages(nextMessages);
    setAttachments(nextAttachments);
    setRecoverableAttachmentsBySession((current) => ({
      ...current,
      [String(payloadSessionId)]: nextRecoverableAttachments,
    }));
    cacheDocumentChat(docId, {
      sessionId: payloadSessionId,
      messages: nextMessages,
      selectedModel: restoredModel || getCachedDocumentChat(docId).selectedModel,
    });
    if (restoredModel) setSelectedModel(restoredModel);
    return true;
  }

  async function handleSelectSession(targetSessionId) {
    const targetSession = sessions.find((item) => Number(item.id) === Number(targetSessionId));
    if (
      !selectedId
      || !targetSession
      || Number(targetSession.primaryDocumentId) !== Number(selectedId)
      || Number(targetSessionId) === Number(sessionIdRef.current)
      || (sessionAction && sessionAction.type !== "select")
    ) return false;
    cancelActiveChatWork();
    try {
      setSessionAction({ type: "select", sessionId: targetSessionId });
      setSessionError("");
      sessionIdRef.current = targetSessionId;
      setSessionId(targetSessionId);
      cacheDocumentChat(selectedId, { sessionId: targetSessionId });
      const cachedMessages = getCachedSessionMessages(targetSessionId);
      setMessages(cachedMessages);
      setAttachments([]);
      setQuestion("");
      setError("");
      const payload = await loadChatHistory(selectedId, {
        sessionId: targetSessionId,
        showLoader: !cachedMessages.length,
      });
      return Boolean(payload);
    } catch (err) {
      setSessionError(err.response?.data?.error || "Could not switch chat sessions");
      return false;
    } finally {
      setSessionAction((current) => (
        current?.type === "select" && Number(current.sessionId) === Number(targetSessionId)
          ? null
          : current
      ));
    }
  }

  async function handleCreateSession() {
    if (!selectedId || sessionAction) return false;
    const targetDocumentId = selectedId;
    cancelActiveChatWork();
    const controller = new AbortController();
    sessionMutationAbortRef.current = controller;
    try {
      setSessionAction({ type: "create", sessionId: null });
      setSessionError("");
      const payload = await createChatSession({
        title: "New chat",
        documentId: targetDocumentId,
        signal: controller.signal,
      });
      if (String(getWorkspaceCache().selectedId || "") !== String(targetDocumentId || "")) return false;
      const nextSessionId = payload.session.id;
      sessionIdRef.current = nextSessionId;
      setSessionId(nextSessionId);
      cacheDocumentChat(selectedId, { sessionId: nextSessionId, messages: [] });
      applySelectedSessionPayload(payload, selectedId);
      setQuestion("");
      const summary = sessionSummaryFromPayload(payload);
      setSessions((current) => [summary, ...current.filter((item) => Number(item.id) !== Number(summary.id))]);
      return true;
    } catch (err) {
      if (err.code === "ERR_CANCELED") return false;
      setSessionError(err.response?.data?.error || "Could not create a chat session");
      return false;
    } finally {
      if (sessionMutationAbortRef.current === controller) {
        sessionMutationAbortRef.current = null;
        setSessionAction(null);
      }
    }
  }

  async function handleRenameSession(targetSessionId, title) {
    if (sessionAction) return false;
    const targetDocumentId = selectedId;
    const controller = new AbortController();
    sessionMutationAbortRef.current = controller;
    try {
      setSessionAction({ type: "rename", sessionId: targetSessionId });
      setSessionError("");
      const payload = await renameChatSession(targetSessionId, title, { signal: controller.signal });
      if (String(getWorkspaceCache().selectedId || "") !== String(targetDocumentId || "")) return false;
      setSessions((current) => current.map((item) => (
        Number(item.id) === Number(targetSessionId)
          ? { ...item, title: payload.session.title, updatedAt: payload.session.updatedAt }
          : item
      )));
      return true;
    } catch (err) {
      if (err.code === "ERR_CANCELED") return false;
      setSessionError(err.response?.data?.error || "Could not rename this chat");
      return false;
    } finally {
      if (sessionMutationAbortRef.current === controller) {
        sessionMutationAbortRef.current = null;
        setSessionAction(null);
      }
    }
  }

  async function handleDeleteSession(targetSessionId) {
    if (sessionAction) return false;
    const targetDocumentId = selectedId;
    const deletingActive = Number(targetSessionId) === Number(sessionIdRef.current);
    if (deletingActive) cancelActiveChatWork();
    const controller = new AbortController();
    sessionMutationAbortRef.current = controller;
    try {
      setSessionAction({ type: "delete", sessionId: targetSessionId });
      setSessionError("");
      await deleteChatSession(targetSessionId, { signal: controller.signal });
      if (String(getWorkspaceCache().selectedId || "") !== String(targetDocumentId || "")) return false;
      clearPendingResponse(targetSessionId);
      removeCachedSession(targetSessionId);
      const remaining = sessions.filter((item) => Number(item.id) !== Number(targetSessionId));
      setSessions(remaining);
      if (!deletingActive) return true;

      setMessages([]);
      setAttachments([]);
      setQuestion("");
      const fallback = remaining[0];
      if (fallback) {
        sessionIdRef.current = fallback.id;
        setSessionId(fallback.id);
        cacheDocumentChat(selectedId, { sessionId: fallback.id });
        await loadChatHistory(selectedId, { sessionId: fallback.id, showLoader: true });
      } else {
        const payload = await createChatSession({
          title: "New chat",
          documentId: targetDocumentId,
          signal: controller.signal,
        });
        if (String(getWorkspaceCache().selectedId || "") !== String(targetDocumentId || "")) return false;
        const summary = sessionSummaryFromPayload(payload);
        sessionIdRef.current = summary.id;
        setSessionId(summary.id);
        cacheDocumentChat(selectedId, { sessionId: summary.id, messages: [] });
        applySelectedSessionPayload(payload, selectedId);
        setSessions([summary]);
      }
      return true;
    } catch (err) {
      if (err.code === "ERR_CANCELED") return false;
      setSessionError(err.response?.data?.error || "Could not delete this chat");
      return false;
    } finally {
      if (sessionMutationAbortRef.current === controller) {
        sessionMutationAbortRef.current = null;
        setSessionAction(null);
      }
    }
  }

  function applyAttachmentPayload(payload, targetSessionId) {
    const payloadSessionId = payload?.session?.id;
    if (Number(payloadSessionId) !== Number(targetSessionId)) return false;
    if (Number(sessionIdRef.current) !== Number(targetSessionId)) return false;

    const {
      activeAttachments: nextAttachments,
      recoverableAttachments: nextRecoverableAttachments,
    } = normalizeAttachmentPayload(payload);
    setAttachments(nextAttachments);
    setSessions((current) => current.map((item) => (
      Number(item.id) === Number(targetSessionId)
        ? { ...item, attachmentCount: nextAttachments.length, updatedAt: new Date().toISOString() }
        : item
    )));
    setRecoverableAttachmentsBySession((current) => ({
      ...current,
      [String(targetSessionId)]: nextRecoverableAttachments,
    }));
    return true;
  }

  function attachmentFailureMessage(err, fallback) {
    return err.response?.data?.message || err.response?.data?.error || fallback;
  }

  async function handleAttachExisting(document) {
    const targetSessionId = sessionId;
    const targetDocumentId = selectedId;
    if (!targetSessionId || attachmentAction) return false;
    if (attachments.length + attachmentQueue.reservedCount >= MAX_CHAT_ATTACHMENTS) {
      setAttachmentError("This chat already has 20 active documents.");
      return false;
    }

    const controller = new AbortController();
    attachmentRequestAbortRef.current = controller;
    try {
      setAttachmentAction({ type: "attach", documentId: document.id });
      setAttachmentError("");
      const payload = await attachChatDocument(targetSessionId, document.id, { signal: controller.signal });
      if (String(getWorkspaceCache().selectedId || "") !== String(targetDocumentId || "")) return false;
      return applyAttachmentPayload(payload, targetSessionId);
    } catch (err) {
      if (err.code === "ERR_CANCELED") return false;
      setAttachmentError(attachmentFailureMessage(err, "Could not attach this document."));
      return false;
    } finally {
      if (attachmentRequestAbortRef.current === controller) {
        attachmentRequestAbortRef.current = null;
        setAttachmentAction(null);
      }
    }
  }

  async function handleUploadAttachment(file) {
    const targetSessionId = sessionId;
    if (!targetSessionId || attachmentAction) return false;
    const validationError = validateUploadDocFile(file);
    if (validationError) {
      setAttachmentError(validationError);
      return false;
    }
    if (attachments.length + attachmentQueue.reservedCount >= MAX_CHAT_ATTACHMENTS) {
      setAttachmentError("This chat already has 20 active documents.");
      return false;
    }

    const controller = new AbortController();
    attachmentUploadAbortRef.current = controller;
    try {
      setAttachmentAction({ type: "upload" });
      setAttachmentUploadProgress(0);
      setAttachmentError("");
      const payload = await uploadChatDocument(targetSessionId, file, {
        signal: controller.signal,
        onProgress: setAttachmentUploadProgress,
      });
      return applyAttachmentPayload(payload, targetSessionId);
    } catch (err) {
      if (err.code === "ERR_CANCELED") {
        setAttachmentError("Upload cancelled.");
      } else if (isUploadDocTimeoutError(err)) {
        setAttachmentError("Upload timed out while the server was processing the file. Reload this chat before trying again.");
      } else {
        setAttachmentError(attachmentFailureMessage(err, "Could not upload this file."));
      }
      return false;
    } finally {
      if (attachmentUploadAbortRef.current === controller) {
        attachmentUploadAbortRef.current = null;
        setAttachmentAction(null);
        setAttachmentUploadProgress(0);
      }
    }
  }

  function handleCancelAttachmentUpload() {
    attachmentUploadAbortRef.current?.abort();
  }

  async function handleRemoveAttachment(attachment) {
    const targetSessionId = sessionId;
    const targetDocumentId = selectedId;
    if (!targetSessionId || attachmentAction) return false;
    const controller = new AbortController();
    attachmentRequestAbortRef.current = controller;
    try {
      setAttachmentAction({ type: "remove", documentId: attachment.id });
      setAttachmentError("");
      const payload = await detachChatDocument(targetSessionId, attachment.id, { signal: controller.signal });
      if (String(getWorkspaceCache().selectedId || "") !== String(targetDocumentId || "")) return false;
      return applyAttachmentPayload(payload, targetSessionId);
    } catch (err) {
      if (err.code === "ERR_CANCELED") return false;
      setAttachmentError(attachmentFailureMessage(err, "Could not remove this file."));
      return false;
    } finally {
      if (attachmentRequestAbortRef.current === controller) {
        attachmentRequestAbortRef.current = null;
        setAttachmentAction(null);
      }
    }
  }

  async function handleRemoveTemporaryAttachments() {
    const targetSessionId = sessionId;
    const targetDocumentId = selectedId;
    if (!targetSessionId || attachmentAction) return false;
    const controller = new AbortController();
    attachmentRequestAbortRef.current = controller;
    try {
      setAttachmentAction({ type: "remove-temporary" });
      setAttachmentError("");
      const payload = await removeTemporaryChatDocuments(targetSessionId, { signal: controller.signal });
      if (String(getWorkspaceCache().selectedId || "") !== String(targetDocumentId || "")) return false;
      return applyAttachmentPayload(payload, targetSessionId);
    } catch (err) {
      if (err.code === "ERR_CANCELED") return false;
      setAttachmentError(attachmentFailureMessage(err, "Could not remove temporary files."));
      return false;
    } finally {
      if (attachmentRequestAbortRef.current === controller) {
        attachmentRequestAbortRef.current = null;
        setAttachmentAction(null);
      }
    }
  }

  async function handlePermanentlyRemoveRecoverableAttachment(attachment) {
    const targetSessionId = sessionId;
    const targetDocumentId = selectedId;
    if (!targetSessionId || attachmentAction) return false;
    const controller = new AbortController();
    attachmentRequestAbortRef.current = controller;
    try {
      setAttachmentAction({ type: "delete-recoverable", documentId: attachment.id });
      setAttachmentError("");
      const payload = await permanentlyRemoveRecoverableChatDocument(targetSessionId, attachment.id, { signal: controller.signal });
      if (String(getWorkspaceCache().selectedId || "") !== String(targetDocumentId || "")) return false;
      return applyAttachmentPayload(payload, targetSessionId);
    } catch (err) {
      if (err.code === "ERR_CANCELED") return false;
      if (err.response?.status === 410) {
        setRecoverableAttachmentsBySession((current) => ({
          ...current,
          [String(targetSessionId)]: (current[String(targetSessionId)] || []).filter((item) => (
            Number(item.id) !== Number(attachment.id)
          )),
        }));
      }
      setAttachmentError(attachmentFailureMessage(err, "Could not permanently delete this file."));
      return false;
    } finally {
      if (attachmentRequestAbortRef.current === controller) {
        attachmentRequestAbortRef.current = null;
        setAttachmentAction(null);
      }
    }
  }

  async function handlePermanentlyRemoveAllRecoverableAttachments() {
    const targetSessionId = sessionId;
    const targetDocumentId = selectedId;
    if (!targetSessionId || attachmentAction) return false;
    const controller = new AbortController();
    attachmentRequestAbortRef.current = controller;
    try {
      setAttachmentAction({ type: "delete-recoverable-all" });
      setAttachmentError("");
      const payload = await permanentlyRemoveRecoverableChatDocuments(targetSessionId, { signal: controller.signal });
      if (String(getWorkspaceCache().selectedId || "") !== String(targetDocumentId || "")) return false;
      return applyAttachmentPayload(payload, targetSessionId);
    } catch (err) {
      if (err.code === "ERR_CANCELED") return false;
      setAttachmentError(attachmentFailureMessage(err, "Could not permanently delete recoverable files."));
      return false;
    } finally {
      if (attachmentRequestAbortRef.current === controller) {
        attachmentRequestAbortRef.current = null;
        setAttachmentAction(null);
      }
    }
  }

  async function handleRestoreAttachment(attachment) {
    const targetSessionId = sessionId;
    const targetDocumentId = selectedId;
    if (!targetSessionId || attachmentAction) return false;
    const controller = new AbortController();
    attachmentRequestAbortRef.current = controller;
    try {
      setAttachmentAction({ type: "restore", documentId: attachment.id });
      setAttachmentError("");
      const payload = await restoreChatDocument(targetSessionId, attachment.id, { signal: controller.signal });
      if (String(getWorkspaceCache().selectedId || "") !== String(targetDocumentId || "")) return false;
      return applyAttachmentPayload(payload, targetSessionId);
    } catch (err) {
      if (err.code === "ERR_CANCELED") return false;
      if (err.response?.status === 410) {
        setRecoverableAttachmentsBySession((current) => ({
          ...current,
          [String(targetSessionId)]: (current[String(targetSessionId)] || []).map((item) => (
            Number(item.id) === Number(attachment.id)
              ? { ...item, lifecycleStatus: "purged", canRestore: false }
              : item
          )),
        }));
      }
      setAttachmentError(attachmentFailureMessage(err, "Could not restore this file."));
      return false;
    } finally {
      if (attachmentRequestAbortRef.current === controller) {
        attachmentRequestAbortRef.current = null;
        setAttachmentAction(null);
      }
    }
  }

  async function handleSaveAttachment(attachment) {
    const targetSessionId = sessionId;
    const targetDocumentId = selectedId;
    if (!targetSessionId || attachmentAction) return false;
    const controller = new AbortController();
    attachmentRequestAbortRef.current = controller;
    try {
      setAttachmentAction({ type: "save", documentId: attachment.id });
      setAttachmentError("");
      const payload = await saveChatDocumentToLibrary(targetSessionId, attachment.id, { signal: controller.signal });
      if (String(getWorkspaceCache().selectedId || "") !== String(targetDocumentId || "")) return false;
      if (!applyAttachmentPayload(payload, targetSessionId)) return false;

      const nextDocuments = await loadWorkspaceDocuments();
      setDocuments(nextDocuments || []);
      cacheWorkspaceState({ documents: nextDocuments || [] });
      return true;
    } catch (err) {
      if (err.code === "ERR_CANCELED") return false;
      setAttachmentError(attachmentFailureMessage(err, "Could not save this file to My Documents."));
      return false;
    } finally {
      if (attachmentRequestAbortRef.current === controller) {
        attachmentRequestAbortRef.current = null;
        setAttachmentAction(null);
      }
    }
  }

  function handleChatScroll(event) {
    if (selectedId) {
      cacheDocumentChat(selectedId, { scrollTop: event.currentTarget.scrollTop });
    }
  }

  async function handleProcess() {
    if (!selectedDocument) return;

    try {
      setIsProcessing(true);
      setError("");
      const result = await processDocumentForAi(selectedDocument.id);
      cacheDocumentChat(selectedDocument.id, { processResult: result });
      setProcessResult(result);
      setDocuments((current) => {
        const updatedDocument = result.document || {};
        const nextDocuments = current.map((doc) => (
          Number(doc.id) === Number(selectedDocument.id)
            ? {
              ...doc,
              ...updatedDocument,
              extracted_text: updatedDocument.extracted_text ?? doc.extracted_text,
              extraction_status: updatedDocument.extraction_status ?? "ready",
              extraction_error: updatedDocument.extraction_error ?? null,
              extraction_metadata: updatedDocument.extraction_metadata ?? doc.extraction_metadata,
              status: updatedDocument.status ?? "indexed",
            }
            : doc
        ));
        cacheWorkspaceState({ documents: nextDocuments });
        return nextDocuments;
      });
    } catch (err) {
      setError(err.response?.data?.error || "Could not process this document");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleAsk(event, customQuestion) {
    if (event) event.preventDefault();
    const isPayload = customQuestion && typeof customQuestion === "object" && !Array.isArray(customQuestion);
    const questionToAsk = isPayload
      ? (customQuestion.question || customQuestion.displayText || "")
      : ((typeof customQuestion === "string" ? customQuestion : question) || "");
    const displayQuestion = isPayload
      ? (customQuestion.displayText || questionToAsk)
      : questionToAsk;
    const cleanedQuestion = questionToAsk.trim();
    const cleanedDisplay = displayQuestion.trim();
    if (!selectedDocument || !cleanedQuestion || isAsking) return;

    const userMessage = buildUserMessage(cleanedDisplay);
    const streamAssistantId = `assistant-stream-${Date.now()}`;
    const activeModel = selectedModel || usage?.model || "gemini-2.5-flash";
    const targetSessionId = sessionId;
    const targetDocumentId = selectedDocument.id;
    const requestId = ++askRequestRef.current;
    const streamController = new AbortController();
    streamAbortRef.current?.abort();
    streamAbortRef.current = streamController;
    const isCurrentRequest = () => (
      requestId === askRequestRef.current
      && String(getWorkspaceCache().selectedId || "") === String(targetDocumentId || "")
      && Number(sessionIdRef.current || 0) === Number(targetSessionId || 0)
    );
    if (targetSessionId) {
      pendingResponsesRef.current.set(String(targetSessionId), {
        documentId: targetDocumentId,
        userContent: cleanedDisplay,
        optimisticUserId: userMessage.id,
        optimisticAssistantId: streamAssistantId,
      });
    }
    setMessages((current) => {
      const nextMessages = [...current, userMessage, {
        id: streamAssistantId,
        role: "assistant",
        content: "",
        sources: [],
        mode: answerMode,
        provider: selectedModel?.startsWith("qwen") ? "ollama" : "gemini",
        model: activeModel,
        usedRag: false,
        isStreaming: true,
        streamStatus: "Checking document...",
      }];
      cacheSessionMessages(targetSessionId, nextMessages);
      return nextMessages;
    });
    if (targetSessionId) scheduleSessionRevalidation(targetSessionId, targetDocumentId);
    if (isPayload) {
      setQuestion(cleanedDisplay);
    } else if (!customQuestion) {
      setQuestion("");
    }
    setError("");

    try {
      setIsAsking(true);
      const streamRequest = targetSessionId
        ? askSessionStream(targetSessionId, {
          question: cleanedQuestion,
          displayQuestion: cleanedDisplay,
          mode: answerMode,
          model: activeModel,
          signal: streamController.signal,
          onStatus: (status) => {
            if (!isCurrentRequest()) return;
            setMessages((current) => {
              const nextMessages = current.map((message) => (
                message.id === streamAssistantId
                  ? { ...message, streamStatus: status }
                  : message
              ));
              cacheSessionMessages(targetSessionId, nextMessages);
              return nextMessages;
            });
          },
          onToken: (text) => {
            if (!isCurrentRequest()) return;
            setMessages((current) => {
              const nextMessages = current.map((message) => (
                message.id === streamAssistantId
                  ? { ...message, content: `${message.content || ""}${text}`, streamStatus: "" }
                  : message
              ));
              cacheSessionMessages(targetSessionId, nextMessages);
              return nextMessages;
            });
          },
        })
        : askDocumentStream(selectedDocument.id, {
          question: cleanedQuestion,
          displayQuestion: cleanedDisplay,
          mode: answerMode,
          model: activeModel,
          signal: streamController.signal,
          onStatus: (status) => {
            if (!isCurrentRequest()) return;
            setMessages((current) => {
              const nextMessages = current.map((message) => (
                message.id === streamAssistantId
                  ? { ...message, streamStatus: status }
                  : message
              ));
              cacheSessionMessages(targetSessionId, nextMessages);
              return nextMessages;
            });
          },
          onToken: (text) => {
            if (!isCurrentRequest()) return;
            setMessages((current) => {
              const nextMessages = current.map((message) => (
                message.id === streamAssistantId
                  ? { ...message, content: `${message.content || ""}${text}`, streamStatus: "" }
                  : message
              ));
              cacheSessionMessages(targetSessionId, nextMessages);
              return nextMessages;
            });
          },
        });
      const result = await streamRequest;
      const persistedUser = result.messages?.user ? mapStoredMessage(result.messages.user) : null;
      const persistedAssistant = result.messages?.assistant
        ? mapStoredMessage(result.messages.assistant)
        : buildAssistantMessage(result);
      const reconciledMessages = reconcilePersistedAsk(
        getCachedSessionMessages(targetSessionId),
        {
          optimisticUserId: userMessage.id,
          optimisticAssistantId: streamAssistantId,
          persistedUser,
          persistedAssistant,
        }
      );
      publishSessionMessages(targetSessionId, targetDocumentId, reconciledMessages);
      clearPendingResponse(targetSessionId);
      if (!isCurrentRequest()) return;
      const nextSessionId = result.sessionId || sessionId;
      cacheDocumentChat(selectedDocument.id, { sessionId: nextSessionId });
      setSessionId(nextSessionId);
      if (result.usage) {
        cacheWorkspaceState({ usage: result.usage });
        setUsage(result.usage);
      } else {
        refreshUsage(activeModel).catch(() => { });
      }
      setSessions((current) => current.map((item) => (
        Number(item.id) === Number(nextSessionId)
          ? { ...item, lastActivityAt: new Date().toISOString() }
          : item
      )));
      setProcessResult((current) => {
        const nextProcessResult = current || {
          document: result.document,
          sourceCount: result.sources?.length || 0,
          status: "ready",
        };
        cacheDocumentChat(selectedDocument.id, { processResult: nextProcessResult });
        return nextProcessResult;
      });
    } catch (err) {
      if (!isCurrentRequest() || err.name === "AbortError") return;
      let requestError = err;
      const hasStreamedText = getCachedDocumentChat(selectedDocument.id).messages
        .some((message) => message.id === streamAssistantId && message.content);
      if (!hasStreamedText) {
        try {
          const result = targetSessionId
            ? await askSession(targetSessionId, cleanedQuestion, answerMode, activeModel)
            : await askDocument(selectedDocument.id, cleanedQuestion, answerMode, activeModel);
          const persistedUser = result.messages?.user ? mapStoredMessage(result.messages.user) : null;
          const persistedAssistant = result.messages?.assistant
            ? mapStoredMessage(result.messages.assistant)
            : buildAssistantMessage(result);
          const reconciledMessages = reconcilePersistedAsk(
            getCachedSessionMessages(targetSessionId),
            {
              optimisticUserId: userMessage.id,
              optimisticAssistantId: streamAssistantId,
              persistedUser,
              persistedAssistant,
            }
          );
          publishSessionMessages(targetSessionId, targetDocumentId, reconciledMessages);
          clearPendingResponse(targetSessionId);
          if (!isCurrentRequest()) return;
          const nextSessionId = result.sessionId || sessionId;
          cacheDocumentChat(selectedDocument.id, { sessionId: nextSessionId });
          setSessionId(nextSessionId);
          if (result.usage) {
            cacheWorkspaceState({ usage: result.usage });
            setUsage(result.usage);
          }
          setSessions((current) => current.map((item) => (
            Number(item.id) === Number(nextSessionId)
              ? { ...item, lastActivityAt: new Date().toISOString() }
              : item
          )));
          return;
        } catch (fallbackErr) {
          requestError = fallbackErr;
        }
      }
      const responseData = requestError.response?.data;
      if (responseData?.answer) {
        const persistedUser = responseData.messages?.user
          ? mapStoredMessage(responseData.messages.user)
          : null;
        const persistedAssistant = responseData.messages?.assistant
          ? mapStoredMessage(responseData.messages.assistant)
          : buildAssistantMessage(responseData);
        const reconciledMessages = reconcilePersistedAsk(
          getCachedSessionMessages(targetSessionId),
          {
            optimisticUserId: userMessage.id,
            optimisticAssistantId: streamAssistantId,
            persistedUser,
            persistedAssistant,
          }
        );
        publishSessionMessages(targetSessionId, targetDocumentId, reconciledMessages);
        clearPendingResponse(targetSessionId);
        const nextSessionId = responseData.sessionId || sessionId;
        cacheDocumentChat(selectedDocument.id, { sessionId: nextSessionId });
        setSessionId(nextSessionId);
        if (responseData.usage) {
          cacheWorkspaceState({ usage: responseData.usage });
          setUsage(responseData.usage);
        }
      } else {
        if (responseData?.usage) {
          cacheWorkspaceState({ usage: responseData.usage });
          setUsage(responseData.usage);
        }
        setMessages((current) => {
          const nextMessages = current.filter((message) => (
            message.id !== streamAssistantId || message.content
          ));
          cacheSessionMessages(targetSessionId, nextMessages);
          return nextMessages;
        });
        setError(responseData?.message || responseData?.error || "Could not ask AI about this document");
      }
    } finally {
      if (requestId === askRequestRef.current) {
        streamAbortRef.current = null;
        setIsAsking(false);
      }
    }
  }

  return (
    <div className="flex h-[calc(100dvh-65px)] flex-col overflow-hidden bg-[#eceef1] text-slate-800">
      <main className="workspace-theme flex min-h-0 flex-1 gap-2 overflow-hidden bg-[#eceef1] p-2 text-sm leading-relaxed text-slate-800">
        <DocumentSidebar
          collapsed={sidebarCollapsed}
          documents={documents}
          isLoadingDocs={isLoadingDocs}
          onNewDocument={uploadDoc.open}
          onSelectDocument={selectDocument}
          onToggleCollapse={toggleSidebarCollapsed}
          selectedId={selectedId}
          width={sidebarWidth}
        />

        {!sidebarCollapsed ? <WorkspaceResizeHandle label="Resize document sidebar" onMouseDown={onResizeSidebar} /> : null}

        <DocumentViewer
          changeZoom={changeZoom}
          className="min-w-0 flex-1"
          currentPage={currentPage}
          isPdfLoading={isPdfLoading}
          isProcessing={isProcessing}
          onReloadPdf={() => selectedDocument && loadPdfPreview(selectedDocument.id)}
          onReprocess={handleProcess}
          pdfBlobUrl={pdfBlobUrl}
          docxSignedUrl={docxSignedUrl}
          pdfLoadError={pdfLoadError}
          processResult={processResult}
          selectedDocument={selectedDocument}
          setCurrentPage={setCurrentPage}
          setTotalPages={setTotalPages}
          setViewMode={setViewMode}
          totalPages={totalPages}
          viewMode={viewMode}
          zoom={zoom}
        />

        {!chatCollapsed ? <WorkspaceResizeHandle label="Resize AI chat panel" onMouseDown={onResizeChat} /> : null}

        {chatCollapsed ? (
          <div className="relative shrink-0" style={{ width: 0 }}>
            <button
              aria-label="Expand AI chat panel"
              aria-expanded="false"
              className="absolute right-0 top-1/2 z-30 flex h-9 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-[#c7c4d7] bg-white text-sm font-bold text-slate-600 shadow-sm transition hover:border-[#5b4fd4] hover:bg-indigo-50 hover:text-[#5b4fd4]"
              onClick={() => setChatCollapsed(false)}
              type="button"
            >
              {"<"}
            </button>
          </div>
        ) : (
        <div
          className="relative flex h-full min-h-0 shrink-0 flex-col gap-2 transition-[width,opacity] duration-200 ease-out"
          style={{ width: chatWidth }}
        >
          <button
            aria-label="Collapse AI chat panel"
            aria-expanded="true"
            className="absolute -left-[13px] top-1/2 z-30 flex h-9 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-[#c7c4d7] bg-white text-sm font-bold text-slate-600 shadow-sm transition hover:border-[#5b4fd4] hover:bg-indigo-50 hover:text-[#5b4fd4]"
            onClick={() => setChatCollapsed(true)}
            type="button"
          >
            {">"}
          </button>
          <div className="flex shrink-0 items-center justify-start border border-slate-200/60 bg-slate-50/80 p-1 rounded-xl gap-1">
            <button
              onClick={() => setRightActiveTab("chat")}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg border-0 cursor-pointer transition-all duration-200 ${rightActiveTab === "chat"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "bg-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              Trò chuyện AI
            </button>
            <button
              onClick={() => setRightActiveTab("studio")}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg border-0 cursor-pointer transition-all duration-200 ${rightActiveTab === "studio"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "bg-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              Studio
            </button>
          </div>

          <div className="flex-1 min-h-0 flex gap-2">
            <div className={rightActiveTab === "chat" ? "flex-1 min-h-0 flex flex-col overflow-hidden" : "hidden"}>
              <AIChatPanel
                attachmentAction={attachmentAction}
                attachmentError={attachmentError}
                attachmentUploadProgress={attachmentUploadProgress}
                attachmentQueueItems={attachmentQueue.items}
                attachments={attachments}
                availableDocuments={documents}
                answerMode={answerMode}
                chatScrollRef={chatScrollRef}
                className="flex-1 min-h-0 w-full"
                dragDropAttachmentsEnabled={dragDropAttachmentsEnabled}
                error={error}
                geminiModels={geminiModels}
                isAsking={isAsking}
                isAttachmentQueueBlocking={attachmentQueue.isBlocking}
                isLoadingMessages={isLoadingMessages}
                isLoadingSessions={isLoadingSessions}
                isLoadingUsage={isLoadingUsage}
                isOllamaModel={isOllamaModel}
                messages={messages}
                ollamaModels={ollamaModels}
                onAnswerModeChange={setAnswerMode}
                onAttachDocument={handleAttachExisting}
                onCancelAttachmentUpload={handleCancelAttachmentUpload}
                onDropFiles={attachmentQueue.enqueue}
                onRemoveQueuedAttachment={attachmentQueue.remove}
                onRetryQueuedAttachment={attachmentQueue.retry}
                onAsk={handleAsk}
                onChatScroll={handleChatScroll}
                onQuestionChange={setQuestion}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
                onPermanentlyRemoveAllRecoverableAttachments={handlePermanentlyRemoveAllRecoverableAttachments}
                onPermanentlyRemoveRecoverableAttachment={handlePermanentlyRemoveRecoverableAttachment}
                onRemoveAttachment={handleRemoveAttachment}
                onRemoveTemporaryAttachments={handleRemoveTemporaryAttachments}
                onRestoreAttachment={handleRestoreAttachment}
                onSaveAttachment={handleSaveAttachment}
                onRenameSession={handleRenameSession}
                onSelectSession={handleSelectSession}
                onSelectedModelChange={setSelectedModel}
                onUploadAttachment={dragDropAttachmentsEnabled ? attachmentQueue.enqueue : handleUploadAttachment}
                question={question}
                recoverableAttachments={recoverableAttachments}
                selectedDocument={selectedDocument}
                selectedModel={selectedModel}
                sessionId={sessionId}
                sessionAction={sessionAction}
                sessionError={sessionError}
                sessions={sessions}
                usage={usage}
                width={null}
              />
            </div>
            <div className={rightActiveTab === "studio" ? "flex-1 min-h-0 flex flex-col overflow-hidden" : "hidden"}>
              <WorkspaceStudioPanel
                selectedDocument={selectedDocument}
                selectedModel={selectedModel}
                className="flex-1 min-h-0 w-full"
                width={null}
                onPrepareQuestion={(questionText) => {
                  setRightActiveTab("chat");
                  setQuestion(questionText);
                }}
                onAskQuestion={(questionText) => {
                  setRightActiveTab("chat");
                  handleAsk(null, questionText);
                }}
              />
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
