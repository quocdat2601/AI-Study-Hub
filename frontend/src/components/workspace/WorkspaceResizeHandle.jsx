import React from "react";

export default function WorkspaceResizeHandle({ onMouseDown, label }) {
  return (
    <div
      aria-label={label}
      className="group relative z-20 flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-slate-200/80 transition hover:bg-indigo-400/70"
      onMouseDown={onMouseDown}
      role="separator"
    >
      <span className="pointer-events-none h-10 w-0.5 rounded-full bg-slate-400/0 transition group-hover:bg-white/90" />
    </div>
  );
}
