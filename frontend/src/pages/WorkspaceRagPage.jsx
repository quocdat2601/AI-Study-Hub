import React, { useCallback, useEffect, useMemo, useState } from "react";
import { askDocument, getAiModelStatus, getAiUsage, processDocumentForAi } from "../services/aiApi.js";
import { getChatSessionMessages, getOrCreateChatSession } from "../services/chatApi.js";
import { listDocuments } from "../services/documentApi.js";

const MODEL_LABELS = {
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "gemini-3-flash": "Gemini 3 Flash",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "qwen2.5:1.5b": "Qwen 2.5 1.5B",
  "qwen2.5:3b": "Qwen 2.5 3B",
  "qwen2.5:7b": "Qwen 2.5 7B",
};

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

function getSubjectLabel(doc) {
  return doc.subjects?.code || doc.subjectCode || doc.subject || "No subject";
}

function getStatusLabel(doc) {
  if (doc.extraction_status === "ready") return "Text ready";
  if (doc.extraction_status === "empty") return "No readable text";
  if (doc.extraction_status === "failed") return "Extraction failed";
  return "Needs processing";
}

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
    provider: data.provider || "gemini",
    model: data.model,
  };
}

function mapStoredMessage(message) {
  return {
    id: message.id || `${message.role}-${message.created_at}`,
    role: message.role,
    content: message.content,
    sources: [],
    mode: "stored",
  };
}

const ASKING_STATUSES = [
  "Reading document...",
  "Retrieving relevant sections...",
  "Generating answer...",
];

function usagePercent(used, limit) {
  if (!limit) return 0;
  return Math.min(100, Math.round((Number(used || 0) / Number(limit || 1)) * 100));
}

function usageBarClass(percent) {
  if (percent >= 100) return "bg-[#dc2626]";
  if (percent >= 80) return "bg-[#f59e0b]";
  return "bg-[#4648d4]";
}

function UsageRow({ label, used, limit }) {
  const percent = usagePercent(used, limit);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-bold text-[#344154]">{label}</span>
        <span className={percent >= 100 ? "font-extrabold text-[#dc2626]" : "font-bold text-[#66758a]"}>{used} / {limit}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#e6ebf2]">
        <span className={`block h-full rounded-full ${usageBarClass(percent)}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Trang Workspace RAG thử nghiệm — chọn model, chunk, hybrid mode. */
export default function WorkspaceRagPage() {
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState("");
  const [answerMode, setAnswerMode] = useState("hybrid");
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState(DEFAULT_MODELS);
  const [modelStatus, setModelStatus] = useState(null);
  const [usage, setUsage] = useState(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [askingStatusIndex, setAskingStatusIndex] = useState(0);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState("");
  const [processResult, setProcessResult] = useState(null);

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
        setIsLoadingDocs(true);
        setError("");
        const data = await listDocuments();
        if (!isMounted) return;
        setDocuments(data || []);
        setSelectedId(data?.[0]?.id || null);
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
        setAvailableModels([...geminiModels, ...ollamaModels]);
        setSelectedModel((current) => current || status.defaultModel || "gemini-2.5-flash");
      } catch {
        if (isMounted) {
          setAvailableModels(DEFAULT_MODELS);
          setSelectedModel((current) => current || "gemini-2.5-flash");
        }
      }
    }

    loadModelStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadChatHistory = useCallback(async (docId) => {
    try {
      setIsLoadingMessages(true);
      setError("");
      const session = await getOrCreateChatSession(docId);
      setSessionId(session.id);
      const payload = await getChatSessionMessages(session.id);
      setMessages((payload.messages || []).map(mapStoredMessage));
    } catch (err) {
      setSessionId(null);
      setMessages([]);
      setError(err.response?.data?.error || "Could not load chat history");
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadChatHistory(selectedId);
    }
  }, [selectedId, loadChatHistory]);

  async function refreshUsage(model = selectedModel) {
    try {
      setIsLoadingUsage(true);
      const data = await getAiUsage(model || undefined);
      setUsage(data);
      if (data.allowedModels?.length) {
        setAvailableModels(data.allowedModels);
      }
      if (data.provider === "ollama") {
        const status = await getAiModelStatus().catch(() => null);
        if (status) setModelStatus(status);
      }
      if (data.model && data.model !== selectedModel) {
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
    refreshUsage(selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    if (!isAsking) {
      setAskingStatusIndex(0);
      return undefined;
    }

    setAskingStatusIndex(0);
    const intervalId = window.setInterval(() => {
      setAskingStatusIndex((current) => Math.min(current + 1, ASKING_STATUSES.length - 1));
    }, 900);

    return () => window.clearInterval(intervalId);
  }, [isAsking]);

  function selectDocument(docId) {
    setSelectedId(docId);
    setMessages([]);
    setSessionId(null);
    setQuestion("");
    setProcessResult(null);
    setError("");
  }

  async function handleProcess() {
    if (!selectedDocument) return;

    try {
      setIsProcessing(true);
      setError("");
      const result = await processDocumentForAi(selectedDocument.id);
      setProcessResult(result);
      setDocuments((current) => current.map((doc) => (
        Number(doc.id) === Number(selectedDocument.id)
          ? { ...doc, extraction_status: "ready", status: "indexed" }
          : doc
      )));
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

    setMessages((current) => [...current, buildUserMessage(cleanedQuestion)]);
    setQuestion("");
    setError("");
    const activeModel = selectedModel || usage?.model || "gemini-2.5-flash";

    try {
      setIsAsking(true);
      const result = await askDocument(selectedDocument.id, cleanedQuestion, answerMode, activeModel);
      setMessages((current) => [...current, buildAssistantMessage(result)]);
      setSessionId(result.sessionId || sessionId);
      if (result.usage) {
        setUsage(result.usage);
      } else {
        await refreshUsage(activeModel);
      }
      setProcessResult((current) => current || {
        document: result.document,
        chunkCount: result.sources?.length || 0,
        status: "ready",
      });
    } catch (err) {
      if (err.response?.data?.usage) {
        setUsage(err.response.data.usage);
      } else {
        await refreshUsage(activeModel);
      }
      setError(err.response?.data?.message || err.response?.data?.error || "Could not ask AI about this document");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-64px)] bg-[#f4f7fb] text-[#172033] lg:h-[calc(100vh-64px)] lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:overflow-hidden">
      <aside className="border-b border-[#d8deea] bg-white p-4 lg:h-full lg:overflow-hidden lg:border-b-0 lg:border-r">
        <div className="mb-4">
          <h1 className="m-0 text-lg font-extrabold">Workspace RAG</h1>
          <p className="mt-1 text-xs text-[#66758a]">Experimental RAG workspace with model controls.</p>
        </div>

        {isLoadingDocs ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((item) => <div className="h-20 animate-pulse rounded-lg bg-[#eef2f8]" key={item} />)}
          </div>
        ) : documents.length ? (
          <div className="grid max-h-[calc(100vh-160px)] gap-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-170px)]">
            {documents.map((doc) => (
              <button
                className={
                  Number(selectedId) === Number(doc.id)
                    ? "rounded-lg border border-[#4648d4] bg-[#eef0ff] p-3 text-left shadow-sm"
                    : "rounded-lg border border-[#d8deea] bg-white p-3 text-left transition hover:border-[#4648d4]"
                }
                key={doc.id}
                onClick={() => selectDocument(doc.id)}
                type="button"
              >
                <strong className="line-clamp-2 block text-sm">{doc.title}</strong>
                <span className="mt-2 block text-xs font-bold text-[#4648d4]">{getSubjectLabel(doc)}</span>
                <span className="mt-1 block text-xs text-[#66758a]">{getStatusLabel(doc)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-[#c7c4d7] p-4 text-sm text-[#66758a]">No documents available.</p>
        )}
      </aside>

      <section className="min-w-0 overflow-y-auto p-5">
        {selectedDocument ? (
          <div className="grid gap-4">
            <article className="rounded-xl border border-[#d8deea] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-xs font-black uppercase tracking-[0.08em] text-[#4648d4]">{getSubjectLabel(selectedDocument)}</p>
                  <h2 className="mt-2 mb-1 text-2xl font-extrabold">{selectedDocument.title}</h2>
                  <p className="m-0 text-sm text-[#66758a]">{getStatusLabel(selectedDocument)}</p>
                </div>
                <button
                  className="rounded-full border border-[#4648d4] bg-white px-4 py-2 text-sm font-extrabold text-[#4648d4] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isProcessing}
                  onClick={handleProcess}
                  type="button"
                >
                  {isProcessing ? "Processing..." : "Process for AI"}
                </button>
              </div>

              {processResult ? (
                <p className="mt-4 rounded-lg bg-[#eef0ff] px-3 py-2 text-sm text-[#344154]">
                  Ready for RAG with {processResult.chunkCount} chunk{processResult.chunkCount === 1 ? "" : "s"}.
                </p>
              ) : null}
            </article>

            <article className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-[#c7c4d7] bg-white p-6 text-center">
              <div>
                {selectedDocument.thumbnailUrl ? (
                  <img className="mx-auto max-h-[340px] rounded-lg border border-[#d8deea] object-contain" src={selectedDocument.thumbnailUrl} alt="" />
                ) : (
                  <div className="mx-auto flex h-56 w-44 items-center justify-center rounded-lg border border-[#d8deea] bg-[#f7f9fb] text-sm font-bold text-[#66758a]">
                    Document preview
                  </div>
                )}
                <p className="mt-4 text-sm text-[#66758a]">Final viewer is not ready yet, so this panel is only a placeholder.</p>
              </div>
            </article>
          </div>
        ) : (
          <div className="rounded-xl border border-[#d8deea] bg-white p-8 text-center text-[#66758a]">Select a document to begin.</div>
        )}
      </section>

      <aside className="flex min-h-[520px] flex-col border-t border-[#d8deea] bg-white lg:h-full lg:min-h-0 lg:overflow-hidden lg:border-l lg:border-t-0">
        <div className="flex items-start justify-between gap-3 border-b border-[#d8deea] p-4">
          <div>
            <h2 className="m-0 text-lg font-extrabold">AI Chat</h2>
            <p className="mt-1 text-xs text-[#66758a]">
              {sessionId ? `Session #${sessionId}` : "Ask questions about the selected PDF."}
            </p>
          </div>
          <div className="group relative flex-none">
            <button
              className="rounded-full border border-[#d8deea] bg-[#fbfcfe] px-3 py-1.5 text-xs font-extrabold text-[#4648d4] transition hover:border-[#4648d4] focus:border-[#4648d4] focus:outline-none focus:ring-2 focus:ring-[#dfe3ff]"
              type="button"
            >
              Usage
            </button>
            <section className="invisible absolute right-0 top-10 z-30 w-[300px] translate-y-1 rounded-xl border border-[#d8deea] bg-white p-4 opacity-0 shadow-[0_18px_45px_rgba(20,31,48,0.16)] transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="m-0 text-sm font-extrabold">{isOllamaModel ? "Local AI Status" : "AI Usage"}</h3>
                  <p className="mt-0.5 text-xs text-[#66758a]">{MODEL_LABELS[usage?.model || selectedModel] || usage?.model || selectedModel || "Default model"}</p>
                </div>
                {isLoadingUsage ? <span className="text-[11px] font-bold text-[#66758a]">Updating...</span> : null}
              </div>
              {usage && usage.provider === "ollama" ? (
                <div className="grid gap-2.5 text-xs text-[#344154]">
                  <p className="m-0"><b>Provider:</b> Local Ollama</p>
                  <p className="m-0"><b>Quota:</b> No API quota</p>
                  <p className={usage.local?.available && usage.local?.installed ? "m-0 font-bold text-[#087443]" : "m-0 font-bold text-[#b42318]"}>
                    {usage.local?.available
                      ? usage.local?.installed
                        ? "Status: Available"
                        : "Selected local model is not installed."
                      : "Ollama is not running. Start Ollama to use local Qwen."}
                  </p>
                  <p className="m-0 rounded-lg bg-[#eef2f8] px-3 py-2 text-[11px] text-[#66758a]">{usage.local?.note || "Runs on local machine performance."}</p>
                </div>
              ) : usage ? (
                <div className="grid gap-2.5">
                  {usage.warning ? (
                    <p className="m-0 rounded-lg bg-[#fff7ed] px-3 py-2 text-[11px] font-bold text-[#9a3412]">{usage.warning}</p>
                  ) : null}
                  <UsageRow label="Requests today" used={usage.used.requestsToday} limit={usage.limits.rpd} />
                  <UsageRow label="Requests this minute" used={usage.used.requestsThisMinute} limit={usage.limits.rpm} />
                  <UsageRow label="Tokens this minute" used={usage.used.tokensThisMinute} limit={usage.limits.tpm} />
                  <UsageRow label="Your questions today" used={usage.used.userRequestsToday} limit={usage.limits.dailyUserRequests} />
                </div>
              ) : (
                <p className="m-0 rounded-lg border border-dashed border-[#c7c4d7] p-3 text-xs text-[#66758a]">Usage will appear after the backend responds.</p>
              )}
            </section>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {isLoadingMessages ? (
            <p className="rounded-lg border border-dashed border-[#c7c4d7] p-4 text-sm text-[#66758a]">Loading saved chat...</p>
          ) : messages.length ? messages.map((message) => (
            <div
              className={message.role === "user" ? "ml-auto max-w-[88%] rounded-2xl bg-[#4648d4] px-4 py-3 text-sm text-white" : "max-w-[92%] rounded-2xl bg-[#f1f4f8] px-4 py-3 text-sm text-[#172033]"}
              key={message.id}
            >
              {message.role === "assistant" && message.model ? (
                <p className="mb-2 mt-0 text-[11px] font-bold text-[#66758a]">
                  {message.provider === "ollama" ? "Local Ollama" : "Gemini"} · {MODEL_LABELS[message.model] || message.model}
                </p>
              ) : null}
              <p className="m-0 whitespace-pre-wrap">{message.content}</p>
              {message.sources?.length ? (
                <div className="mt-3 grid gap-2">
                  <p className="m-0 text-xs font-extrabold text-[#4648d4]">Sources</p>
                  {message.sources.map((source) => (
                    <details className="rounded-lg bg-white p-2 text-xs text-[#344154]" key={source.id || source.chunkIndex}>
                      <summary className="cursor-pointer font-bold">Chunk {source.chunkIndex + 1}</summary>
                      <p className="mt-2 line-clamp-6 whitespace-pre-wrap">{source.content}</p>
                    </details>
                  ))}
                </div>
              ) : null}
            </div>
          )) : (
            <p className="rounded-lg border border-dashed border-[#c7c4d7] p-4 text-sm text-[#66758a]">
              Select a document and ask a question. The backend will process chunks automatically if needed.
            </p>
          )}
          {isAsking ? (
            <div className="max-w-[92%] rounded-2xl bg-[#f1f4f8] px-4 py-3 text-sm text-[#66758a]">
              <p className="m-0 font-bold">{ASKING_STATUSES[askingStatusIndex]}</p>
            </div>
          ) : null}
          {error ? <p className="rounded-lg border border-[#ffb4b4] bg-[#fff5f5] p-3 text-sm font-bold text-[#a31313]">{error}</p> : null}
        </div>

        <form className="flex-none border-t border-[#d8deea] bg-white p-4" onSubmit={handleAsk}>
          <label className="mb-3 block text-xs font-extrabold text-[#344154]">
            Model
            <select
              className="mt-1 w-full rounded-lg border border-[#d8deea] bg-white px-3 py-2 text-sm font-bold text-[#172033] outline-none transition focus:border-[#4648d4] focus:ring-2 focus:ring-[#dfe3ff]"
              disabled={isAsking}
              onChange={(event) => setSelectedModel(event.target.value)}
              value={selectedModel || usage?.model || "gemini-2.5-flash"}
            >
              <optgroup label="Gemini">
                {geminiModels.map((model) => (
                  <option key={model} value={model}>{MODEL_LABELS[model] || model}</option>
                ))}
              </optgroup>
              <optgroup label="Local Ollama">
                {ollamaModels.map((model) => (
                  <option key={model} value={model}>{MODEL_LABELS[model] || model}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <fieldset className="mb-3 grid grid-cols-2 rounded-lg border border-[#d8deea] bg-[#f7f9fb] p-1">
            <legend className="sr-only">Answer mode</legend>
            <label className={answerMode === "hybrid" ? "cursor-pointer rounded-md bg-white px-3 py-2 text-center text-xs font-extrabold text-[#4648d4] shadow-sm" : "cursor-pointer rounded-md px-3 py-2 text-center text-xs font-bold text-[#66758a]"}>
              <input
                checked={answerMode === "hybrid"}
                className="sr-only"
                disabled={isAsking}
                name="answerMode"
                onChange={() => setAnswerMode("hybrid")}
                type="radio"
                value="hybrid"
              />
              Hybrid
            </label>
            <label className={answerMode === "document_only" ? "cursor-pointer rounded-md bg-white px-3 py-2 text-center text-xs font-extrabold text-[#4648d4] shadow-sm" : "cursor-pointer rounded-md px-3 py-2 text-center text-xs font-bold text-[#66758a]"}>
              <input
                checked={answerMode === "document_only"}
                className="sr-only"
                disabled={isAsking}
                name="answerMode"
                onChange={() => setAnswerMode("document_only")}
                type="radio"
                value="document_only"
              />
              Document only
            </label>
          </fieldset>
          <textarea
            className="min-h-24 w-full resize-none rounded-lg border border-[#c7c4d7] p-3 text-sm outline-none transition focus:border-[#4648d4] focus:ring-2 focus:ring-[#dfe3ff]"
            disabled={!selectedDocument || isAsking || isLoadingMessages}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={selectedDocument ? "Ask about this document..." : "Select a document first"}
            value={question}
          />
          <button
            className="mt-3 w-full rounded-lg bg-[#4648d4] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#393bc2] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedDocument || !question.trim() || isAsking || isLoadingMessages}
            type="submit"
          >
            {isAsking ? "Sending..." : "Send question"}
          </button>
        </form>
      </aside>
    </main>
  );
}
