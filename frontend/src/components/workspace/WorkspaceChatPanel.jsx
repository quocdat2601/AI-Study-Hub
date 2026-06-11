import React, { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../../contexts/WorkspaceContext.jsx";
import {
  ArrowUpIcon,
  ClockIcon,
  CopyIcon,
  SparklesIcon,
  ThumbsUpIcon,
} from "./WorkspaceIcons.jsx";

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function UserMessage({ message }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2 text-sm leading-relaxed text-white">
        {message.content}
      </div>
      <span className="text-[11px] text-slate-400">{formatTime(message.created_at)}</span>
    </div>
  );
}

function AssistantMessage({ message }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      // Ignore clipboard errors.
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-[11px] font-semibold text-indigo-600">AI ASSISTANT</span>
      <div className="max-w-[95%] whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {message.content}
      </div>
      <div className="flex items-center gap-2">
        <button
          aria-label="Helpful"
          className="cursor-pointer border-0 bg-transparent p-0 text-slate-400 transition hover:text-slate-600"
          type="button"
        >
          <ThumbsUpIcon size={14} />
        </button>
        <button
          aria-label="Copy answer"
          className="cursor-pointer border-0 bg-transparent p-0 text-slate-400 transition hover:text-slate-600"
          onClick={handleCopy}
          type="button"
        >
          <CopyIcon size={14} />
        </button>
      </div>
    </div>
  );
}

export default function WorkspaceChatPanel({ width = 360, className = "" }) {
  const {
    selectedDocument,
    messages,
    isChatLoading,
    isSending,
    chatError,
    chatHint,
    handleSendMessage,
  } = useWorkspace();

  const [draft, setDraft] = useState("");
  const chatEndRef = useRef(null);

  const isExtracting = selectedDocument?.extractionStatus === "pending";
  const isEmptyText = selectedDocument?.extractionStatus === "empty";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function onSubmit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft("");
    await handleSendMessage(text);
  }

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white ${className}`}
      style={{ width }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
          <SparklesIcon className="text-indigo-600" size={15} />
          Ask AI
        </div>
        <button
          aria-label="Chat history"
          className="cursor-pointer border-0 bg-transparent p-0 text-slate-400"
          type="button"
        >
          <ClockIcon size={15} />
        </button>
      </div>

      <div className="workspace-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 text-sm">
        {!selectedDocument ? (
          <p className="text-sm text-slate-500">Chọn tài liệu để bắt đầu chat.</p>
        ) : isChatLoading ? (
          <p className="text-sm text-slate-500">Đang tải chat...</p>
        ) : (
          <>
            {isExtracting ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Đang trích xuất text từ server. Vui lòng đợi thêm.
              </div>
            ) : null}

            {chatHint || isEmptyText ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                {chatHint || "PDF scan — không có text để AI đọc. Bạn vẫn xem file ở tab PDF."}
              </div>
            ) : null}

            {messages.length ? (
              messages.map((message) => (
                message.role === "user" ? (
                  <UserMessage key={message.id} message={message} />
                ) : (
                  <AssistantMessage key={message.id} message={message} />
                )
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-500">
                Hỏi về <strong className="text-slate-800">{selectedDocument.title}</strong>.
                AI dùng nội dung text đã trích xuất để trả lời.
              </div>
            )}
          </>
        )}

        {isSending ? (
          <p className="text-xs text-slate-400">AI đang trả lời...</p>
        ) : null}

        {chatError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{chatError}</p>
        ) : null}

        <div ref={chatEndRef} />
      </div>

      <form className="border-t border-slate-200 p-3" onSubmit={onSubmit}>
        <div className="flex items-end gap-2">
          <input
            className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500"
            disabled={!selectedDocument || isSending}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Hỏi bất cứ điều gì về tài liệu"
            value={draft}
          />
          <button
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-0 bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
            disabled={!selectedDocument || !draft.trim() || isSending}
            type="submit"
          >
            <ArrowUpIcon size={16} />
          </button>
        </div>
        <p className="mb-0 mt-2 text-center text-[10px] text-slate-400">
          AI có thể trả lời không chính xác.
        </p>
      </form>
    </aside>
  );
}
