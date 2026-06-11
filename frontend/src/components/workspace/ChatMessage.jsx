import React from "react";
import { Copy, ThumbsUp } from "lucide-react";

function MessageBody({ content }) {
  const lines = String(content || "").split("\n");
  const hasBullets = lines.some((line) => /^[-•]\s/.test(line.trim()));

  if (!hasBullets) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  return (
    <ul className="m-0 list-disc space-y-2 pl-5">
      {lines
        .map((line) => line.replace(/^[-•]\s*/, "").trim())
        .filter(Boolean)
        .map((line, index) => (
          <li key={`${index}-${line.slice(0, 30)}`}>{line}</li>
        ))}
    </ul>
  );
}

/** Tin nhắn chat — cỡ chữ cân đối với sidebar. */
export default function ChatMessage({ message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="max-w-[92%] rounded-2xl rounded-tr-sm bg-[var(--chat-user-bg)] px-4 py-3 text-[15px] leading-relaxed text-[var(--chat-user-text)]">
          {message.content}
        </div>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          You
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2.5">
      <div className="max-w-[95%] text-[15px] leading-relaxed text-[var(--text-primary)]">
        <MessageBody content={message.content} />
      </div>
      <div className="flex items-center gap-3">
        <button
          className="border-0 bg-transparent p-0 text-[var(--text-muted)] hover:text-[var(--accent)]"
          type="button"
          aria-label="Helpful"
        >
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
        <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent)]">
          AI ASSISTANT
        </span>
      </div>
    </div>
  );
}
