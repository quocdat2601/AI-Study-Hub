import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getDisplayName, getUserInitials } from "../../lib/userDisplay.js";
import { getQuoteStripStyle, normalizeNoteColor } from "../../utils/workspaceNotebookColors.js";
import WorkspaceNotebookColorPicker from "./WorkspaceNotebookColorPicker.jsx";

export default function WorkspaceNotebookViewPopup({
  note,
  cardTop,
  cardLeft,
  isSaving = false,
  onClose,
  onDelete,
  onUpdate,
}) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note?.content || "");
  const [color, setColor] = useState(normalizeNoteColor(note?.color));
  const textareaRef = useRef(null);
  const displayName = getDisplayName(user) || "Bạn";
  const initials = getUserInitials(user) || "BN";

  useEffect(() => {
    setContent(note?.content || "");
    setColor(normalizeNoteColor(note?.color));
    setIsEditing(false);
  }, [note?.id, note?.content, note?.color]);

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  if (!note) return null;

  function handleStartEdit() {
    setContent(note.content);
    setColor(normalizeNoteColor(note.color));
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setContent(note.content);
    setColor(normalizeNoteColor(note.color));
    setIsEditing(false);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onUpdate(note.id, { content: trimmed, color });
  }

  return (
    <div
      className="absolute z-[85]"
      data-workspace-notebook-popup="true"
      style={{ top: cardTop, left: cardLeft, width: 300 }}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseUp={(event) => event.stopPropagation()}
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.14)]">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {user?.avatarUrl ? (
              <img alt="" className="h-8 w-8 rounded-full object-cover" src={user.avatarUrl} />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                {initials}
              </span>
            )}
            <span className="truncate text-sm font-semibold text-slate-800">{displayName}</span>
          </div>
          <button
            className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            Đóng
          </button>
        </div>

        <p
          className="m-0 border-b border-slate-100 px-3 py-2 text-[11px] leading-relaxed"
          style={getQuoteStripStyle(isEditing ? color : note.color)}
        >
          &ldquo;{note.selectedText}&rdquo;
        </p>

        <div className="p-3">
          {isEditing ? (
            <form onSubmit={handleSubmit}>
              <div className="mb-2.5">
                <p className="m-0 mb-1.5 text-[11px] font-semibold text-slate-500">Bảng màu</p>
                <WorkspaceNotebookColorPicker
                  disabled={isSaving}
                  onChange={setColor}
                  value={color}
                />
              </div>

              <textarea
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                disabled={isSaving}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Viết ghi chú..."
                ref={textareaRef}
                rows={4}
                value={content}
              />

              <div className="mt-3 flex justify-end gap-2">
                <button
                  className="cursor-pointer rounded-full border-0 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  disabled={isSaving}
                  onClick={handleCancelEdit}
                  type="button"
                >
                  Hủy
                </button>
                <button
                  className="cursor-pointer rounded-full border-0 bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!content.trim() || isSaving}
                  type="submit"
                >
                  {isSaving ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{note.content}</p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  className="cursor-pointer rounded-full border-0 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  onClick={handleStartEdit}
                  type="button"
                >
                  Sửa
                </button>
                <button
                  className="cursor-pointer rounded-full border-0 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                  onClick={() => onDelete(note.id)}
                  type="button"
                >
                  Xóa
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
