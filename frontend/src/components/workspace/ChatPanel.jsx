import React, { useEffect, useRef } from "react";
import { Clock, Sparkles } from "lucide-react";
import { getChatStatusMessage } from "../../lib/workspaceUtils.js";
import ChatInput from "./ChatInput.jsx";
import ChatMessage from "./ChatMessage.jsx";
import ChatTypingIndicator from "./ChatTypingIndicator.jsx";

export default function ChatPanel({
  selectedDocument,
  messages,
  isLoadingChat,
  isPreparingText,
  extractionStatus,
  isAITyping,
  chatError,
  sendMessage,
}) {
  const scrollRef = useRef(null);
  const statusMessage = getChatStatusMessage({ isLoadingChat, isPreparingText, extractionStatus });
  const isBusy = isLoadingChat || isPreparingText || isAITyping;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAITyping]);

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-chat)]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
        <div className="flex items-center gap-2.5 text-[15px] font-semibold text-[var(--text-primary)]">
          <Sparkles className="text-[var(--accent)]" size={18} />
          Ask AI
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          type="button"
          aria-label="Chat history"
        >
          <Clock size={18} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto workspace-scroll-hidden px-5 py-5" ref={scrollRef}>
        {!selectedDocument && (
          <p className="text-[15px] text-[var(--text-muted)]">Select a document to chat with AI.</p>
        )}

        {selectedDocument && statusMessage && (
          <p className="mb-4 text-[13px] text-[var(--text-secondary)]">{statusMessage}</p>
        )}

        {selectedDocument && messages.length === 0 && !isBusy && (
          <p className="mb-4 text-[15px] text-[var(--text-secondary)]">
            Ask anything about <strong>{selectedDocument.title}</strong>.
          </p>
        )}

        <div className="flex flex-col gap-7">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isAITyping && <ChatTypingIndicator />}
        </div>

        {chatError && <p className="mt-4 text-[13px] text-red-400">{chatError}</p>}
      </div>

      <ChatInput disabled={!selectedDocument || isBusy} onSend={sendMessage} />
    </aside>
  );
}
