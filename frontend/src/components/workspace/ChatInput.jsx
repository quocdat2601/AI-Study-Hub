import React, { useState } from "react";
import { ArrowUp } from "lucide-react";

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState("");

  function sendCurrentValue() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendCurrentValue();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendCurrentValue();
    }
  }

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-panel)] px-4 py-4">
      <form className="relative" onSubmit={handleSubmit}>
        <input
          className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] py-2 pl-4 pr-14 text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 disabled:opacity-50"
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about this"
          value={value}
        />
        <button
          aria-label="Send message"
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border-0 bg-[var(--accent)] text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
          disabled={disabled || !value.trim()}
          type="submit"
        >
          <ArrowUp size={18} />
        </button>
      </form>
      <p className="mt-2.5 text-center text-[12px] text-[var(--text-muted)]">
        AI may produce inaccurate information about the document content.
      </p>
    </div>
  );
}
