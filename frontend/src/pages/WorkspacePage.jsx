import React, { useEffect, useMemo, useRef, useState } from "react";
import { askDocument, askDocumentStream, getAiModelStatus, getAiUsage, processDocumentForAi } from "../services/aiApi.js";
import AIChatPanel from "../components/workspace/AIChatPanel.jsx";
import DocumentSidebar from "../components/workspace/DocumentSidebar.jsx";
import DocumentViewer from "../components/workspace/DocumentViewer.jsx";
import { getChatSessionMessages, getOrCreateDocumentChatSession } from "../services/chatApi.js";
import { listDocuments } from "../services/documentApi.js";
import { cacheDocumentChat, cacheWorkspaceState, getCachedDocumentChat, getWorkspaceCache } from "../utils/workspaceCache.js";

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
  "gemini-3.5-flash",
];
const DEFAULT_OLLAMA_MODELS = [
  "qwen2.5:1.5b",
  "qwen2.5:3b",
  "qwen2.5:7b",
];
const DEFAULT_MODELS = [...DEFAULT_GEMINI_MODELS, ...DEFAULT_OLLAMA_MODELS];

function buildUserMessage(content) {
  return {
    id: `user-${Date.now()}`,
    role: "user",
    content,
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
  };
}

function mapStoredMessage(message) {
  const metadata = message.metadata || {};
  return {
    id: message.id || `${message.role}-${message.created_at}`,
    role: message.role,
    content: message.content,
    sources: metadata.sources || [],
    mode: metadata.mode || "stored",
    provider: metadata.provider,
    model: metadata.model,
    usedRag: Boolean(metadata.usedRag),
    needsProcessing: Boolean(metadata.needsProcessing),
  };
}

export default function WorkspacePage() {
  const cachedWorkspace = getWorkspaceCache();
  const initialSelectedId = cachedWorkspace.selectedId || cachedWorkspace.documents?.[0]?.id || null;
  const initialChat = getCachedDocumentChat(initialSelectedId);
  const chatScrollRef = useRef(null);
  const lastSelectedIdRef = useRef(initialSelectedId);
  const previousMessageCountRef = useRef(initialChat.messages.length);
  const [documents, setDocuments] = useState(() => cachedWorkspace.documents || []);
  const [selectedId, setSelectedId] = useState(() => initialSelectedId);
  const [messages, setMessages] = useState(() => initialChat.messages);
  const [sessionId, setSessionId] = useState(() => initialChat.sessionId);
  const [question, setQuestion] = useState("");
  const [answerMode, setAnswerMode] = useState(() => cachedWorkspace.answerMode || "hybrid");
  const [selectedModel, setSelectedModel] = useState(() => cachedWorkspace.selectedModel || "");
  const [availableModels, setAvailableModels] = useState(() => cachedWorkspace.availableModels || DEFAULT_MODELS);
  const [modelStatus, setModelStatus] = useState(() => cachedWorkspace.modelStatus || null);
  const [usage, setUsage] = useState(() => cachedWorkspace.usage || null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(() => !cachedWorkspace.documents?.length);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState("");
  const [processResult, setProcessResult] = useState(() => initialChat.processResult);

  const selectedDocument = useMemo(
    () => documents.find((doc) => Number(doc.id) === Number(selectedId)) || null,
    [documents, selectedId]
  );
  const geminiModels = modelStatus?.gemini?.models || availableModels.filter((model) => model.startsWith("gemini-"));
  const ollamaModels = modelStatus?.ollama?.allowedModels || availableModels.filter((model) => model.startsWith("qwen"));
  const isOllamaModel = (selectedModel || usage?.model || "").startsWith("qwen") || usage?.provider === "ollama";

  useEffect(() => {
    let isMounted = true;

    async function loadDocuments() {
      try {
        if (!getWorkspaceCache().documents?.length) {
          setIsLoadingDocs(true);
        }
        setError("");
        const data = await listDocuments();
        if (!isMounted) return;
        const nextDocuments = data || [];
        cacheWorkspaceState({ documents: nextDocuments });
        setDocuments(nextDocuments);
        setSelectedId((current) => {
          const cachedSelected = getWorkspaceCache().selectedId;
          const nextSelected = [current, cachedSelected, nextDocuments[0]?.id]
            .find((candidate) => candidate && nextDocuments.some((doc) => Number(doc.id) === Number(candidate))) || null;
          cacheWorkspaceState({ selectedId: nextSelected });
          return nextSelected;
        });
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
          const nextModel = current || getWorkspaceCache().selectedModel || status.defaultModel || "gemini-2.5-flash";
          cacheWorkspaceState({ selectedModel: nextModel });
          return nextModel;
        });
      } catch {
        if (isMounted) {
          setAvailableModels(DEFAULT_MODELS);
          cacheWorkspaceState({ availableModels: DEFAULT_MODELS });
          setSelectedModel((current) => {
            const nextModel = current || getWorkspaceCache().selectedModel || "gemini-2.5-flash";
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

  useEffect(() => {
    if (selectedId) {
      cacheWorkspaceState({ selectedId });
      const cachedChat = getCachedDocumentChat(selectedId);
      if (cachedChat.messages.length) {
        setMessages(cachedChat.messages);
        setSessionId(cachedChat.sessionId);
        setProcessResult(cachedChat.processResult);
      }
      loadChatHistory(selectedId, { showLoader: !cachedChat.messages.length });
    }
  }, [selectedId]);

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
  }, []);

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

  async function loadChatHistory(docId, options = {}) {
    const { showLoader = true } = options;
    try {
      if (showLoader) setIsLoadingMessages(true);
      setError("");
      const session = await getOrCreateDocumentChatSession(docId);
      const payload = await getChatSessionMessages(session.id);
      const nextMessages = (payload.messages || []).map(mapStoredMessage);
      cacheDocumentChat(docId, { sessionId: session.id, messages: nextMessages });
      if (String(getWorkspaceCache().selectedId || "") !== String(docId || "")) {
        return;
      }
      setSessionId(session.id);
      setMessages(nextMessages);
    } catch (err) {
      if (String(getWorkspaceCache().selectedId || "") !== String(docId || "")) {
        return;
      }
      setSessionId(null);
      cacheDocumentChat(docId, { sessionId: null });
      if (showLoader) setMessages([]);
      setError(err.response?.data?.error || "Could not load chat history");
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function refreshUsage(model = selectedModel) {
    try {
      setIsLoadingUsage(true);
      const data = await getAiUsage(model || undefined);
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
      if (data.model && data.model !== selectedModel) {
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
  }

  useEffect(() => {
    if (selectedModel) {
      cacheWorkspaceState({ selectedModel });
      refreshUsage(selectedModel);
    }
  }, [selectedModel]);

  useEffect(() => {
    cacheWorkspaceState({ answerMode });
  }, [answerMode]);

  function selectDocument(docId) {
    const cachedChat = getCachedDocumentChat(docId);
    cacheWorkspaceState({ selectedId: docId });
    setSelectedId(docId);
    setMessages(cachedChat.messages);
    setSessionId(cachedChat.sessionId);
    setQuestion("");
    setProcessResult(cachedChat.processResult);
    setError("");
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
        const nextDocuments = current.map((doc) => (
          Number(doc.id) === Number(selectedDocument.id)
            ? { ...doc, extraction_status: "ready", status: "indexed" }
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

  async function handleAsk(event) {
    event.preventDefault();
    const cleanedQuestion = question.trim();
    if (!selectedDocument || !cleanedQuestion || isAsking) return;

    const userMessage = buildUserMessage(cleanedQuestion);
    const streamAssistantId = `assistant-stream-${Date.now()}`;
    const activeModel = selectedModel || usage?.model || "gemini-2.5-flash";
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
      cacheDocumentChat(selectedDocument.id, { messages: nextMessages });
      return nextMessages;
    });
    setQuestion("");
    setError("");

    try {
      setIsAsking(true);
      const result = await askDocumentStream(selectedDocument.id, {
        question: cleanedQuestion,
        mode: answerMode,
        model: activeModel,
        onStatus: (status) => {
          setMessages((current) => {
            const nextMessages = current.map((message) => (
              message.id === streamAssistantId
                ? { ...message, streamStatus: status }
                : message
            ));
            cacheDocumentChat(selectedDocument.id, { messages: nextMessages });
            return nextMessages;
          });
        },
        onToken: (text) => {
          setMessages((current) => {
            const nextMessages = current.map((message) => (
              message.id === streamAssistantId
                ? { ...message, content: `${message.content || ""}${text}`, streamStatus: "" }
                : message
            ));
            cacheDocumentChat(selectedDocument.id, { messages: nextMessages });
            return nextMessages;
          });
        },
      });
      const assistantMessage = buildAssistantMessage(result);
      setMessages((current) => {
        const nextMessages = current.map((message) => (
          message.id === streamAssistantId ? { ...assistantMessage, id: streamAssistantId } : message
        ));
        cacheDocumentChat(selectedDocument.id, { messages: nextMessages });
        return nextMessages;
      });
      const nextSessionId = result.sessionId || sessionId;
      cacheDocumentChat(selectedDocument.id, { sessionId: nextSessionId });
      setSessionId(nextSessionId);
      if (result.usage) {
        cacheWorkspaceState({ usage: result.usage });
        setUsage(result.usage);
      } else {
        refreshUsage(activeModel).catch(() => {});
      }
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
      const hasStreamedText = getCachedDocumentChat(selectedDocument.id).messages
        .some((message) => message.id === streamAssistantId && message.content);
      if (!hasStreamedText) {
        try {
          const result = await askDocument(selectedDocument.id, cleanedQuestion, answerMode, activeModel);
          const assistantMessage = buildAssistantMessage(result);
          setMessages((current) => {
            const nextMessages = current
              .filter((message) => message.id !== streamAssistantId)
              .concat(assistantMessage);
            cacheDocumentChat(selectedDocument.id, { messages: nextMessages });
            return nextMessages;
          });
          const nextSessionId = result.sessionId || sessionId;
          cacheDocumentChat(selectedDocument.id, { sessionId: nextSessionId });
          setSessionId(nextSessionId);
          if (result.usage) {
            cacheWorkspaceState({ usage: result.usage });
            setUsage(result.usage);
          }
          return;
        } catch (fallbackErr) {
          err = fallbackErr;
        }
      }
      const responseData = err.response?.data;
      if (responseData?.answer) {
        const assistantMessage = buildAssistantMessage(responseData);
        setMessages((current) => {
          const nextMessages = current.map((message) => (
            message.id === streamAssistantId ? { ...assistantMessage, id: streamAssistantId } : message
          ));
          cacheDocumentChat(selectedDocument.id, { messages: nextMessages });
          return nextMessages;
        });
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
          cacheDocumentChat(selectedDocument.id, { messages: nextMessages });
          return nextMessages;
        });
        setError(responseData?.message || responseData?.error || "Could not ask AI about this document");
      }
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-64px)] bg-[#f4f7fb] text-[#172033] lg:h-[calc(100vh-64px)] lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:overflow-hidden">
      <DocumentSidebar
        documents={documents}
        isLoadingDocs={isLoadingDocs}
        onSelectDocument={selectDocument}
        selectedId={selectedId}
      />

      <DocumentViewer
        isProcessing={isProcessing}
        onReprocess={handleProcess}
        processResult={processResult}
        selectedDocument={selectedDocument}
      />

      <AIChatPanel
        answerMode={answerMode}
        chatScrollRef={chatScrollRef}
        error={error}
        geminiModels={geminiModels}
        isAsking={isAsking}
        isLoadingMessages={isLoadingMessages}
        isLoadingUsage={isLoadingUsage}
        isOllamaModel={isOllamaModel}
        messages={messages}
        ollamaModels={ollamaModels}
        onAnswerModeChange={setAnswerMode}
        onAsk={handleAsk}
        onChatScroll={handleChatScroll}
        onQuestionChange={setQuestion}
        onSelectedModelChange={setSelectedModel}
        question={question}
        selectedDocument={selectedDocument}
        selectedModel={selectedModel}
        sessionId={sessionId}
        usage={usage}
      />
    </main>
  );
}
