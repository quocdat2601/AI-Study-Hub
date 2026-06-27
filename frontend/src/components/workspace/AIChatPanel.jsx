import React, { useState } from "react";
import ChatAttachmentBar from "./ChatAttachmentBar.jsx";
import ChatSessionMenu from "./ChatSessionMenu.jsx";
import { MODEL_LABELS } from "./workspaceDisplay.js";
import { ArrowUpIcon, ChevronDownIcon, ClockIcon, CopyIcon, SparklesIcon, UploadIcon } from "./WorkspaceIcons.jsx";

const SUGGESTED_QUESTIONS = [
  "Summarize this document",
  "What are the key points?",
  "Create quiz questions",
  "Explain this like I'm studying for an exam",
];

function usagePercent(used, limit) {
  if (!limit) return 0;
  return Math.min(100, Math.round((Number(used || 0) / Number(limit || 1)) * 100));
}

function usageBarClass(percent) {
  if (percent >= 100) return "bg-red-600";
  if (percent >= 80) return "bg-amber-500";
  return "bg-indigo-600";
}

function UsageRow({ label, limit, used }) {
  const percent = usagePercent(used, limit);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className={percent >= 100 ? "font-bold text-red-600" : "font-bold text-slate-500"}>{used} / {limit}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100">
        <span className={`block h-full rounded-full ${usageBarClass(percent)}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function UsagePopover({ activeModel, isLoadingUsage, isOllamaModel, selectedModel, usage }) {
  return (
    <div className="group relative flex-none">
      <button
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        type="button"
      >
        Usage
      </button>
      <section className="invisible absolute right-0 top-9 z-30 w-[300px] translate-y-1 rounded-xl border border-slate-200 bg-white p-4 opacity-0 shadow-[0_18px_45px_rgba(15,23,42,0.16)] transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="m-0 text-sm font-bold text-slate-900">{isOllamaModel ? "Local AI Status" : "AI Usage"}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{MODEL_LABELS[usage?.model || selectedModel] || usage?.model || activeModel}</p>
          </div>
          {isLoadingUsage ? <span className="text-[11px] font-semibold text-slate-500">Updating...</span> : null}
        </div>
        {usage && usage.provider === "ollama" ? (
          <div className="grid gap-2.5 text-xs text-slate-600">
            <p className="m-0"><b>Provider:</b> Local Ollama</p>
            <p className="m-0"><b>Quota:</b> No API quota</p>
            <p className={usage.local?.available && usage.local?.installed ? "m-0 font-bold text-emerald-700" : "m-0 font-bold text-red-600"}>
              {usage.local?.available
                ? usage.local?.installed
                  ? "Status: Available"
                  : "Selected local model is not installed."
                : "Ollama is not running. Start Ollama to use local Qwen."}
            </p>
            <p className="m-0 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">{usage.local?.note || "Runs on local machine performance."}</p>
          </div>
        ) : usage ? (
          <div className="grid gap-2.5">
            {usage.warning ? <p className="m-0 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">{usage.warning}</p> : null}
            <UsageRow label="Requests today" used={usage.used.requestsToday} limit={usage.limits.rpd} />
            <UsageRow label="Requests this minute" used={usage.used.requestsThisMinute} limit={usage.limits.rpm} />
            <UsageRow label="Tokens this minute" used={usage.used.tokensThisMinute} limit={usage.limits.tpm} />
            <UsageRow label="Your questions today" used={usage.used.userRequestsToday} limit={usage.limits.dailyUserRequests} />
          </div>
        ) : (
          <p className="m-0 rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">Usage will appear after the backend responds.</p>
        )}
      </section>
    </div>
  );
}

function SourceList({ sources }) {
  if (!sources?.length) return null;
  const validSources = sources.filter((source) => (
    source.chunkDocumentId == null
    || Number(source.documentId) === Number(source.chunkDocumentId)
  ));
  if (!validSources.length) return null;

  return (
    <details className="mt-2 rounded-xl border border-slate-200 bg-white/80 p-2 text-xs text-slate-600">
      <summary className="cursor-pointer list-none font-bold text-slate-600 marker:hidden">
        <span className="mr-1 text-slate-400">+</span>
        Sources ({validSources.length})
      </summary>
      <div className="mt-2 grid max-h-36 gap-1.5 overflow-y-auto pr-1">
        {validSources.map((source) => {
          const pageStart = source.pageStart ?? source.pageNumber;
          const pageEnd = source.pageEnd ?? source.pageNumber;
          const pageLabel = pageStart == null
            ? ""
            : pageStart === pageEnd ? ` - Page ${pageStart}` : ` - Pages ${pageStart}-${pageEnd}`;
          return (
            <details className="group rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5" key={`${source.documentId}-${source.chunkId ?? source.id ?? source.chunkIndex}`}>
              <summary className="cursor-pointer list-none font-semibold text-slate-700 marker:hidden">
                <span className="mr-1 text-slate-400 group-open:hidden">+</span>
                <span className="mr-1 hidden text-slate-400 group-open:inline">-</span>
                {source.documentTitle || "Document"}{pageLabel} - Chunk {Number(source.chunkIndex || 0) + 1}
                {source.score ? <span className="ml-2 font-medium text-slate-400">{Number(source.score).toFixed(2)}</span> : null}
              </summary>
              <p className="mt-1.5 line-clamp-4 select-text whitespace-pre-wrap leading-relaxed text-slate-500">{source.content}</p>
            </details>
          );
        })}
      </div>
    </details>
  );
}

function ModelBadge({ message }) {
  if (message.role !== "assistant") return null;
  if (message.model) {
    return (
      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
        <SparklesIcon className="text-indigo-500" size={11} />
        {message.provider === "ollama" ? "Local Ollama" : "Gemini"} {" - "} {MODEL_LABELS[message.model] || message.model}
      </span>
    );
  }
  if (message.provider === "system") {
    return <span className="mb-1 text-[10px] font-semibold text-slate-400">AI Study Hub assistant</span>;
  }
  return null;
}

function MessageBubble({ message }) {
  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(message.content || "");
    } catch {
      // Clipboard can fail when the browser blocks permission.
    }
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="workspace-selectable max-w-[78%] select-text rounded-2xl rounded-tr-md bg-indigo-600 px-3.5 py-2 text-sm leading-relaxed text-white shadow-sm">
          <p className="m-0 select-text whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  const content = message.isStreaming && !message.content ? message.streamStatus : message.content;

  return (
    <div className="flex justify-start">
      <div className="max-w-[88%]">
        <ModelBadge message={message} />
        <div className="workspace-selectable rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">
          <p className="m-0 select-text whitespace-pre-wrap break-words">{content}</p>
          <SourceList sources={message.sources} />
        </div>
        {message.content ? (
          <button
            className="mt-1 flex cursor-pointer items-center gap-1 border-0 bg-transparent px-1 py-0.5 text-[11px] font-medium text-slate-400 transition hover:text-slate-600"
            onClick={copyAnswer}
            type="button"
          >
            <CopyIcon size={12} />
            Copy
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SuggestionChips({ onQuestionChange, selectedDocument }) {
  if (!selectedDocument) return null;

  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-500">
      <p className="m-0 mb-2 text-slate-600">Ask about <strong className="text-slate-900">{selectedDocument.title}</strong>.</p>
      <div className="grid gap-2">
        {SUGGESTED_QUESTIONS.map((prompt, index) => (
          <button
            className={index === 0
              ? "cursor-pointer rounded-xl border border-indigo-300 bg-white px-3 py-2 text-left text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
              : "cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50"}
            key={prompt}
            onClick={() => onQuestionChange(prompt)}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <span>Create</span>
        <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600" onClick={() => onQuestionChange("Create flashcards from this document")} type="button">Flashcards</button>
        <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600" onClick={() => onQuestionChange("Create slide outline from this document")} type="button">Slides</button>
      </div>
    </div>
  );
}

function ModelMenu({
  activeModel,
  geminiModels,
  isAsking,
  ollamaModels,
  onSelectedModelChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const groups = [
    { label: "Gemini", models: geminiModels },
    { label: "Local Ollama", models: ollamaModels },
  ];

  function chooseModel(model) {
    onSelectedModelChange(model);
    setIsOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <button
        className="flex max-w-[160px] items-center gap-1.5 truncate rounded-full px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isAsking}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="truncate">{MODEL_LABELS[activeModel] || activeModel}</span>
        <ChevronDownIcon className="shrink-0" size={12} />
      </button>

      {isOpen ? (
        <div className="absolute bottom-full right-0 z-40 mb-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
          {groups.map((group) => (
            <div className="py-1" key={group.label}>
              <p className="m-0 px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{group.label}</p>
              <div className="grid gap-1">
                {group.models.map((model) => {
                  const isActive = model === activeModel;
                  return (
                    <button
                      className={isActive
                        ? "flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-left text-sm font-bold text-indigo-600"
                        : "flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"}
                      key={model}
                      onClick={() => chooseModel(model)}
                      type="button"
                    >
                      <span className="truncate">{MODEL_LABELS[model] || model}</span>
                      {isActive ? <span className="text-xs">Selected</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BottomControls({
  activeModel,
  answerMode,
  geminiModels,
  isAsking,
  ollamaModels,
  onAnswerModeChange,
  onSelectedModelChange,
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <fieldset className="grid w-[132px] shrink-0 grid-cols-2 rounded-full bg-slate-100 p-0.5">
        <legend className="sr-only">Answer mode</legend>
        <label className={answerMode === "hybrid" ? "cursor-pointer rounded-full bg-white px-2 py-1 text-center text-[11px] font-bold text-indigo-600 shadow-sm" : "cursor-pointer rounded-full px-2 py-1 text-center text-[11px] font-semibold text-slate-500"}>
          <input checked={answerMode === "hybrid"} className="sr-only" disabled={isAsking} name="answerMode" onChange={() => onAnswerModeChange("hybrid")} type="radio" value="hybrid" />
          Hybrid
        </label>
        <label className={answerMode === "document_only" ? "cursor-pointer rounded-full bg-white px-2 py-1 text-center text-[11px] font-bold text-indigo-600 shadow-sm" : "cursor-pointer rounded-full px-2 py-1 text-center text-[11px] font-semibold text-slate-500"}>
          <input checked={answerMode === "document_only"} className="sr-only" disabled={isAsking} name="answerMode" onChange={() => onAnswerModeChange("document_only")} type="radio" value="document_only" />
          Doc only
        </label>
      </fieldset>
      <div className="min-w-0 flex-1" />
      <ModelMenu
        activeModel={activeModel}
        geminiModels={geminiModels}
        isAsking={isAsking}
        ollamaModels={ollamaModels}
        onSelectedModelChange={onSelectedModelChange}
      />
    </div>
  );
}

function CompactInput({
  activeModel,
  answerMode,
  geminiModels,
  isAsking,
  isAttachmentQueueBlocking,
  isLoadingMessages,
  ollamaModels,
  onAnswerModeChange,
  onAsk,
  onQuestionChange,
  onSelectedModelChange,
  question,
  selectedDocument,
}) {
  return (
    <form className="flex-none border-t border-slate-200 bg-white p-2.5" onSubmit={onAsk}>
      <div className="rounded-2xl border border-slate-200 bg-white p-2 transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
        <textarea
          className="min-h-14 w-full resize-none border-0 bg-transparent px-2 py-1 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
          disabled={!selectedDocument || isAsking || isLoadingMessages || isAttachmentQueueBlocking}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder={selectedDocument ? "Ask any question..." : "Select a document first"}
          value={question}
        />
        <div className="flex items-center gap-2 pt-1">
          <BottomControls
            activeModel={activeModel}
            answerMode={answerMode}
            geminiModels={geminiModels}
            isAsking={isAsking}
            ollamaModels={ollamaModels}
            onAnswerModeChange={onAnswerModeChange}
            onSelectedModelChange={onSelectedModelChange}
          />
          <button
            aria-label="Send question"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border-0 bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selectedDocument || !question.trim() || isAsking || isLoadingMessages || isAttachmentQueueBlocking}
            type="submit"
          >
            {isAsking ? <ClockIcon size={15} /> : <ArrowUpIcon size={15} />}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function AIChatPanel({
  attachmentAction,
  attachmentError,
  attachmentUploadProgress,
  attachmentQueueItems = [],
  attachments,
  availableDocuments,
  answerMode,
  chatScrollRef,
  className = "",
  error,
  geminiModels,
  isAsking,
  isAttachmentQueueBlocking,
  isLoadingMessages,
  isLoadingUsage,
  isOllamaModel,
  messages,
  ollamaModels,
  onAnswerModeChange,
  onAttachDocument,
  onCancelAttachmentUpload,
  onClearPendingAttachments,
  onDropFiles,
  onAsk,
  onChatScroll,
  onQuestionChange,
  onPermanentlyRemoveRecoverableAttachment,
  onPermanentlyRemoveAllRecoverableAttachments,
  onRemoveAttachment,
  onRemoveTemporaryAttachments,
  onRemoveQueuedAttachment,
  onRestoreAttachment,
  onRetryQueuedAttachment,
  onSaveAttachment,
  onSelectedModelChange,
  onUploadAttachment,
  question,
  recoverableAttachments,
  selectedDocument,
  selectedModel,
  sessionId,
  sessions,
  sessionAction,
  sessionError,
  isLoadingSessions,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  onSelectSession,
  usage,
  width,
  dragDropAttachmentsEnabled = false,
}) {
  const activeModel = selectedModel || usage?.model || "gemini-2.5-flash";
  const [dragDepth, setDragDepth] = useState(0);
  const isDropActive = dragDropAttachmentsEnabled && dragDepth > 0;

  function hasFiles(event) {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  }

  function handleDragEnter(event) {
    if (!dragDropAttachmentsEnabled || !hasFiles(event)) return;
    event.preventDefault();
    setDragDepth((depth) => depth + 1);
  }

  function handleDragOver(event) {
    if (!dragDropAttachmentsEnabled || !hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event) {
    if (!dragDropAttachmentsEnabled || !hasFiles(event)) return;
    event.preventDefault();
    setDragDepth((depth) => Math.max(0, depth - 1));
  }

  function handleDrop(event) {
    if (!dragDropAttachmentsEnabled || !hasFiles(event)) return;
    event.preventDefault();
    setDragDepth(0);
    onDropFiles?.(event.dataTransfer.files);
  }

  return (
    <aside
      className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={width ? { width } : undefined}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <SparklesIcon className="text-indigo-600" size={15} />
            AI Chat
          </div>
          <p className="m-0 truncate text-xs text-slate-500">
            {sessionId ? `Session #${sessionId}` : selectedDocument ? "Ask about this document" : "Select a document first"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <UsagePopover
            activeModel={activeModel}
            isLoadingUsage={isLoadingUsage}
            isOllamaModel={isOllamaModel}
            selectedModel={selectedModel}
            usage={usage}
          />
        </div>
      </div>

      <ChatSessionMenu
        activeSessionId={sessionId}
        busySessionId={sessionAction?.sessionId}
        error={sessionError}
        isCreating={sessionAction?.type === "create"}
        isLoading={isLoadingSessions}
        onCreate={onCreateSession}
        onDelete={onDeleteSession}
        onRename={onRenameSession}
        onSelect={onSelectSession}
        sessions={sessions}
      />

      <ChatAttachmentBar
        action={attachmentAction}
        activeAttachments={attachments}
        dragDropAttachmentsEnabled={dragDropAttachmentsEnabled}
        availableDocuments={availableDocuments}
        error={attachmentError}
        isLoading={isLoadingMessages}
        onAttach={onAttachDocument}
        onCancelUpload={onCancelAttachmentUpload}
        onClearPending={onClearPendingAttachments}
        onDeleteRecoverable={onPermanentlyRemoveRecoverableAttachment}
        onDeleteAllRecoverable={onPermanentlyRemoveAllRecoverableAttachments}
        onRemove={onRemoveAttachment}
        onRemoveTemporary={onRemoveTemporaryAttachments}
        onRemoveQueued={onRemoveQueuedAttachment}
        onRestore={onRestoreAttachment}
        onRetryQueued={onRetryQueuedAttachment}
        onSave={onSaveAttachment}
        onUpload={onUploadAttachment}
        primaryDocumentId={selectedDocument?.id}
        pendingItems={attachmentQueueItems}
        recoverableAttachments={recoverableAttachments}
        sessionId={sessionId}
        uploadProgress={attachmentUploadProgress}
      />

      <div className="workspace-scrollbar workspace-selectable min-h-0 flex-1 space-y-3 overflow-y-auto bg-white p-3" onScroll={onChatScroll} ref={chatScrollRef}>
        {isLoadingMessages ? (
          <div className="grid gap-3">
            <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            <div className="ml-auto h-11 w-2/3 animate-pulse rounded-2xl bg-indigo-100" />
          </div>
        ) : messages.length ? (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        ) : selectedDocument ? (
          <SuggestionChips onQuestionChange={onQuestionChange} selectedDocument={selectedDocument} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-500">
            Select a document from the sidebar to start chatting.
          </div>
        )}
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      </div>

      <CompactInput
        activeModel={activeModel}
        answerMode={answerMode}
        geminiModels={geminiModels}
        isAsking={isAsking}
        isAttachmentQueueBlocking={isAttachmentQueueBlocking}
        isLoadingMessages={isLoadingMessages}
        ollamaModels={ollamaModels}
        onAnswerModeChange={onAnswerModeChange}
        onAsk={onAsk}
        onQuestionChange={onQuestionChange}
        onSelectedModelChange={onSelectedModelChange}
        question={question}
        selectedDocument={selectedDocument}
      />
      {isDropActive ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-5 backdrop-blur-[1px]">
          <div className="flex max-w-xs flex-col items-center rounded-2xl border border-indigo-200 bg-white/95 px-7 py-6 text-center shadow-[0_20px_50px_rgba(15,23,42,0.2)]">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><UploadIcon size={21} /></span>
            <p className="m-0 text-sm font-bold text-slate-900">Drop files to add them to this chat</p>
            <p className="m-0 mt-1 text-xs leading-relaxed text-slate-500">PDF, DOCX, TXT, and supported images</p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
