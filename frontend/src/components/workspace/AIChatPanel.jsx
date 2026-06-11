import React from "react";
import { MODEL_LABELS } from "./workspaceDisplay.js";

function usagePercent(used, limit) {
  if (!limit) return 0;
  return Math.min(100, Math.round((Number(used || 0) / Number(limit || 1)) * 100));
}

function usageBarClass(percent) {
  if (percent >= 100) return "bg-[#dc2626]";
  if (percent >= 80) return "bg-[#f59e0b]";
  return "bg-[#4648d4]";
}

function UsageRow({ label, limit, used }) {
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

function SourceList({ sources }) {
  if (!sources?.length) return null;

  return (
    <div className="mt-3 grid gap-2">
      <p className="m-0 text-xs font-extrabold text-[#4648d4]">Sources</p>
      {sources.map((source) => (
        <details className="rounded-lg bg-white p-2 text-xs text-[#344154]" key={source.id || source.chunkIndex}>
          <summary className="cursor-pointer font-bold">Chunk {source.chunkIndex + 1}</summary>
          <p className="mt-2 line-clamp-6 whitespace-pre-wrap">{source.content}</p>
        </details>
      ))}
    </div>
  );
}

export default function AIChatPanel({
  answerMode,
  chatScrollRef,
  error,
  geminiModels,
  isAsking,
  isLoadingMessages,
  isLoadingUsage,
  isOllamaModel,
  messages,
  ollamaModels,
  onAnswerModeChange,
  onAsk,
  onChatScroll,
  onQuestionChange,
  onSelectedModelChange,
  question,
  selectedDocument,
  selectedModel,
  sessionId,
  usage,
}) {
  return (
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

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" onScroll={onChatScroll} ref={chatScrollRef}>
        {isLoadingMessages ? (
          <p className="rounded-lg border border-dashed border-[#c7c4d7] p-4 text-sm text-[#66758a]">Loading saved chat...</p>
        ) : messages.length ? messages.map((message) => (
          <div
            className={message.role === "user" ? "ml-auto max-w-[88%] rounded-2xl bg-[#4648d4] px-4 py-3 text-sm text-white" : "max-w-[92%] rounded-2xl bg-[#f1f4f8] px-4 py-3 text-sm text-[#172033]"}
            key={message.id}
          >
            {message.role === "assistant" && message.model ? (
              <p className="mb-2 mt-0 text-[11px] font-bold text-[#66758a]">
                {message.provider === "ollama" ? "Local Ollama" : "Gemini"} Â· {MODEL_LABELS[message.model] || message.model}
              </p>
            ) : message.role === "assistant" && message.provider === "system" ? (
              <p className="mb-2 mt-0 text-[11px] font-bold text-[#66758a]">AI Study Hub assistant</p>
            ) : null}
            <p className="m-0 whitespace-pre-wrap">
              {message.isStreaming && !message.content ? message.streamStatus : message.content}
            </p>
            <SourceList sources={message.sources} />
          </div>
        )) : (
          <p className="rounded-lg border border-dashed border-[#c7c4d7] p-4 text-sm text-[#66758a]">
            Select a document and ask a question. AI Study Hub will prepare the document automatically if needed.
          </p>
        )}
        {error ? <p className="rounded-lg border border-[#ffb4b4] bg-[#fff5f5] p-3 text-sm font-bold text-[#a31313]">{error}</p> : null}
      </div>

      <form className="flex-none border-t border-[#d8deea] bg-white p-4" onSubmit={onAsk}>
        <label className="mb-3 block text-xs font-extrabold text-[#344154]">
          Model
          <select
            className="mt-1 w-full rounded-lg border border-[#d8deea] bg-white px-3 py-2 text-sm font-bold text-[#172033] outline-none transition focus:border-[#4648d4] focus:ring-2 focus:ring-[#dfe3ff]"
            disabled={isAsking}
            onChange={(event) => onSelectedModelChange(event.target.value)}
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
              onChange={() => onAnswerModeChange("hybrid")}
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
              onChange={() => onAnswerModeChange("document_only")}
              type="radio"
              value="document_only"
            />
            Document only
          </label>
        </fieldset>
        <textarea
          className="min-h-24 w-full resize-none rounded-lg border border-[#c7c4d7] p-3 text-sm outline-none transition focus:border-[#4648d4] focus:ring-2 focus:ring-[#dfe3ff]"
          disabled={!selectedDocument || isAsking || isLoadingMessages}
          onChange={(event) => onQuestionChange(event.target.value)}
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
  );
}
