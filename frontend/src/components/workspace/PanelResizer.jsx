import React, { useEffect, useRef } from "react";
import { GripVertical } from "lucide-react";

export default function PanelResizer({ onResize }) {
  const draggingRef = useRef(false);
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  function startDrag(event) {
    event.preventDefault();
    draggingRef.current = true;

    function handleMouseMove(moveEvent) {
      if (!draggingRef.current) return;
      onResizeRef.current(moveEvent.movementX);
    }

    function handleMouseUp() {
      draggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <button
      aria-label="Resize panel"
      className="group relative z-10 flex w-1 shrink-0 cursor-col-resize items-center justify-center border-0 bg-[var(--border)] p-0 transition hover:bg-[var(--accent)]/30"
      onMouseDown={startDrag}
      type="button"
    >
      <span className="absolute flex h-8 w-4 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)] opacity-0 shadow-sm transition group-hover:opacity-100">
        <GripVertical size={12} />
      </span>
    </button>
  );
}
