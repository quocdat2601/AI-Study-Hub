import React, { useEffect } from "react";
import { getNoteColorOption } from "../../utils/workspaceNotebookColors.js";

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WorkspaceNotesPopover({ notes, onClose, onDelete, documentId }) {
  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (!e.target.closest("[data-notes-popover]") && !e.target.closest("[data-notes-trigger]")) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleOpenNote = (note) => {
    // Dispatch highlight event to scroll and highlight in the current view
    window.dispatchEvent(new CustomEvent("workspace-highlight-citation", {
      detail: { 
        documentId, 
        content: note.selectedText, 
        pageNumber: note.pageNumber 
      }
    }));
    onClose();
  };

  return (
    <div 
      data-notes-popover="true"
      className="absolute right-0 top-full mt-2.5 z-[100] w-[340px] rounded-xl border border-slate-200 bg-white shadow-xl cursor-default"
    >
      {/* Arrow pointing up */}
      <div className="absolute -top-[6px] right-6 h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white" />
      
      <header className="border-b border-slate-100 px-4 py-3 relative bg-white rounded-t-xl z-10">
        <p className="m-0 text-sm font-bold text-slate-900">Ghi chú tài liệu</p>
        <p className="m-0 mt-0.5 text-[11px] font-medium text-slate-500">{notes.length} ghi chú</p>
      </header>

      <div className="max-h-[360px] overflow-y-auto p-3 relative z-10 workspace-scrollbar">
        {notes.length ? (
          <div className="grid grid-cols-2 gap-2">
            {notes.map((note) => {
              const colorOption = getNoteColorOption(note.color);
              return (
                <div 
                  key={note.id} 
                  className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 flex flex-col hover:border-indigo-300 hover:shadow-sm transition cursor-pointer"
                  onClick={() => handleOpenNote(note)}
                >
                  <div className="mb-2 flex items-start gap-1.5">
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorOption.swatch }}
                    />
                    <p className="m-0 line-clamp-2 text-[11px] font-semibold leading-[1.4]" style={{ color: colorOption.stripText }}>
                      &ldquo;{note.selectedText}&rdquo;
                    </p>
                  </div>
                  <p className="m-0 mt-auto text-[12px] text-slate-700 line-clamp-3 leading-snug break-words">
                    {note.content}
                  </p>
                  
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/60 pt-2">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatTime(note.createdAt)}
                    </span>
                    <button
                      className="cursor-pointer rounded border-0 bg-transparent px-1 py-0.5 text-[10px] font-bold text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(note.id);
                      }}
                      type="button"
                      title="Xóa ghi chú"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="m-0 px-1 py-8 text-center text-[13px] text-slate-500">
            Không có ghi chú nào. <br />
            <span className="text-[11px] opacity-70">Bôi đen chữ trong tài liệu để tạo ghi chú.</span>
          </p>
        )}
      </div>
    </div>
  );
}
