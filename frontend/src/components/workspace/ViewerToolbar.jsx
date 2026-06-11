import React from "react";
import { Download, FileText, Maximize2, Minus, Plus } from "lucide-react";

export default function ViewerToolbar({
  selectedDocument,
  zoom,
  currentPage,
  totalPages,
  onZoomChange,
  onPageChange,
  onDownload,
  onToggleFullscreen,
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-panel)] px-4 text-[15px]">
      <div className="flex min-w-0 items-center gap-2 text-[var(--text-primary)]">
        <FileText className="shrink-0 text-[var(--text-muted)]" size={18} />
        <span className="truncate font-medium">
          {selectedDocument?.title || "No document selected"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-[var(--text-secondary)]">
        <div className="flex items-center gap-1">
          <button
            className="flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] bg-[var(--bg-base)] hover:bg-[var(--bg-hover)]"
            onClick={() => onZoomChange(-10)}
            type="button"
            aria-label="Zoom out"
          >
            <Minus size={14} />
          </button>
          <span className="min-w-[48px] text-center text-[13px] font-medium">{zoom}%</span>
          <button
            className="flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] bg-[var(--bg-base)] hover:bg-[var(--bg-hover)]"
            onClick={() => onZoomChange(10)}
            type="button"
            aria-label="Zoom in"
          >
            <Plus size={14} />
          </button>
        </div>

        <span className="text-[13px] font-medium">
          Page {currentPage} / {totalPages}
        </span>

        <div className="flex items-center gap-1">
          <button
            className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1.5 text-[13px] hover:bg-[var(--bg-hover)] disabled:opacity-40"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            type="button"
          >
            Prev
          </button>
          <button
            className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1.5 text-[13px] hover:bg-[var(--bg-hover)] disabled:opacity-40"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            type="button"
          >
            Next
          </button>
        </div>

        <button
          className="flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
          disabled={!selectedDocument}
          onClick={onDownload}
          type="button"
          aria-label="Download"
        >
          <Download size={14} />
        </button>

        <button
          className="flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] bg-[var(--bg-base)] hover:bg-[var(--bg-hover)]"
          onClick={onToggleFullscreen}
          type="button"
          aria-label="Fullscreen"
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
}
