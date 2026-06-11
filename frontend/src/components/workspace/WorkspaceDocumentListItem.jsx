import React from "react";
import { BookmarkIcon, FileTextIcon } from "./WorkspaceIcons.jsx";

export default function WorkspaceDocumentListItem({
  document,
  isSelected,
  isBookmarked,
  onSelect,
  onToggleBookmark,
}) {
  return (
    <div
      className={`group w-full cursor-pointer border-l-4 px-4 py-3 transition ${
        isSelected
          ? "border-l-[#5b4fd4] bg-[#eef3ff]"
          : "border-l-transparent bg-transparent hover:bg-slate-50/80"
      }`}
      onClick={() => onSelect(document.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(document.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${isSelected ? "text-[#5b4fd4]" : "text-slate-400"}`}>
          <FileTextIcon size={16} />
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`mb-1.5 block truncate text-[13px] leading-snug ${
              isSelected ? "font-semibold text-slate-900" : "font-medium text-slate-800"
            }`}
          >
            {document.title}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
                isSelected
                  ? "bg-[#5b4fd4] text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {document.subject}
            </span>
            <span>{document.date}</span>
            <span className="text-slate-300">•</span>
            <span>{document.type}</span>
          </span>
        </span>

        <button
          aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
          className={`mt-0.5 shrink-0 cursor-pointer border-0 bg-transparent p-0 transition ${
            isBookmarked || isSelected
              ? "text-[#5b4fd4] opacity-100"
              : "text-slate-300 opacity-100 group-hover:text-slate-400"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleBookmark(document.id);
          }}
          type="button"
        >
          <BookmarkIcon filled={isBookmarked} size={15} />
        </button>
      </div>
    </div>
  );
}
