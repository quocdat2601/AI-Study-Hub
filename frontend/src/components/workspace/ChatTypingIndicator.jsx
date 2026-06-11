import React from "react";

/** Ba chấm khi AI đang trả lời — giống mockup, không dùng bubble. */
export default function ChatTypingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--text-muted)] [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--text-muted)] [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--text-muted)] [animation-delay:300ms]" />
    </div>
  );
}
