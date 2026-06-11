import React from "react";
import { Copy, ThumbsUp } from "lucide-react";

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="max-w-[92%] rounded-2xl rounded-tr-sm bg-[var(--chat-user-bg)] px-4 py-3 text-[15px] leading-relaxed text-[var(--chat-user-text)]">
          {message.content}
        </div>
        <span className="text-[12px] font-semibold uppercase text-[var(--text-muted)]">You</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2.5">
      <p className="m-0 max-w-[95%] whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text-primary)]">
        {message.content}
      </p>
      <div className="flex items-center gap-3">
        <button className="border-0 bg-transparent p-0 text-[var(--text-muted)] hover:text-[var(--accent)]" type="button" aria-label="Helpful">
          <ThumbsUp size={16} />
        </button>
        <button
          className="border-0 bg-transparent p-0 text-[var(--text-muted)] hover:text-[var(--accent)]"
          onClick={() => navigator.clipboard?.writeText(message.content)}
          type="button"
          aria-label="Copy"
        >
          <Copy size={16} />
        </button>
        <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent)]">AI ASSISTANT</span>
      </div>
    </div>
  );
}
