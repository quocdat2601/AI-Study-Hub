import React from "react";
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

export default function WorkspaceNotebookPanel({ notes, onClose, onDelete, onOpenNote }) {
  return (
    <aside
      className="absolute bottom-4 right-4 z-[70] flex w-[min(360px,calc(100%-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.14)]"
      data-workspace-notebook-panel="true"
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="m-0 text-sm font-bold text-slate-900">Notebook</p>
          <p className="m-0 text-[11px] text-slate-500">{notes.length} ghi chú</p>
        </div>
        <button
          className="cursor-pointer rounded-md border-0 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          onClick={onClose}
          type="button"
        >
          Đóng
        </button>
      </header>

      <div className="max-h-[320px] overflow-y-auto p-3">
        {notes.length ? (
          <ul className="m-0 grid list-none gap-2 p-0">
            {notes.map((note) => {
              const colorOption = getNoteColorOption(note.color);
              return (
              <li className="rounded-lg border border-slate-100 bg-slate-50 p-3" key={note.id}>
                <button
                  className="m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-left"
                  onClick={() => onOpenNote(note)}
                  type="button"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorOption.swatch }}
                    />
                    <p className="m-0 line-clamp-1 text-[11px] font-semibold" style={{ color: colorOption.stripText }}>
                      &ldquo;{note.selectedText}&rdquo;
                    </p>
                  </div>
                  <p className="m-0 mt-1 text-sm text-slate-700">{note.content}</p>
                  <p className="m-0 mt-2 text-[10px] text-slate-400">
                    {note.viewMode === "pdf" && note.pageNumber ? `Trang ${note.pageNumber} · ` : ""}
                    {note.viewMode === "text" && note.paragraphIndex != null ? `Đoạn ${note.paragraphIndex + 1} · ` : ""}
                    {formatTime(note.createdAt)}
                  </p>
                </button>
                <button
                  className="mt-2 cursor-pointer rounded-md border-0 bg-transparent px-0 text-[11px] font-semibold text-red-500 hover:text-red-600"
                  onClick={() => onDelete(note.id)}
                  type="button"
                >
                  Xóa
                </button>
              </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 px-1 py-6 text-center text-sm text-slate-500">
            Bôi đen chữ trong PDF hoặc Text để thêm ghi chú.
          </p>
        )}
      </div>
    </aside>
  );
}
