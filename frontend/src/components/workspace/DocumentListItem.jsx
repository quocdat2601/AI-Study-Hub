import React from "react";
import { Bookmark, FileText } from "lucide-react";
import { getSubjectColor } from "../../lib/workspaceUtils.js";

export default function DocumentListItem({ doc, isSelected, onSelect, onToggleBookmark }) {
  const tagColor = getSubjectColor(doc.subject);

  return (
    <div
      className={`mb-1 flex w-full cursor-pointer items-start gap-3 px-3 py-3 transition ${
        isSelected
          ? "border-l-[3px] border-[var(--accent)] bg-[var(--bg-active)] pl-[9px]"
          : "border-l-[3px] border-transparent hover:bg-[var(--bg-hover)]"
      }`}
      onClick={() => onSelect(doc.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(doc.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <FileText
        className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${isSelected ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}
        fill={isSelected ? "currentColor" : "none"}
        size={18}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--text-primary)]">
            {doc.title}
          </span>
          <button
            className="shrink-0 rounded border-0 bg-transparent p-1 text-[var(--text-muted)] hover:text-[var(--accent)]"
            onClick={(event) => {
              event.stopPropagation();
              onToggleBookmark(doc.id);
            }}
            type="button"
            aria-label={doc.bookmarked ? "Remove bookmark" : "Add bookmark"}
          >
            <Bookmark className={doc.bookmarked ? "fill-current text-[var(--accent)]" : ""} size={16} />
          </button>
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
          <span
            className="rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: tagColor }}
          >
            {doc.subject}
          </span>
          <span aria-hidden="true">·</span>
          <span>{doc.date}</span>
          <span aria-hidden="true">·</span>
          <span className="font-medium">{doc.type}</span>
        </span>
      </span>
    </div>
  );
}
