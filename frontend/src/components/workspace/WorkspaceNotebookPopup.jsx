import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getDisplayName, getUserInitials } from "../../lib/userDisplay.js";
import { DEFAULT_NOTE_COLOR, getQuoteStripStyle } from "../../utils/workspaceNotebookColors.js";
import WorkspaceNotebookColorPicker from "./WorkspaceNotebookColorPicker.jsx";

const CARD_WIDTH = 300;

export default function WorkspaceNotebookPopup({
  color = DEFAULT_NOTE_COLOR,
  onColorChange,
  selectedText,
  cardTop,
  cardLeft,
  isSaving = false,
  onCancel,
  onSave,
}) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const textareaRef = useRef(null);
  const displayName = getDisplayName(user) || "Bạn";
  const initials = getUserInitials(user) || "BN";

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onSave(trimmed, color);
  }

  return (
    <div
      className="absolute z-[80]"
      data-workspace-notebook-popup="true"
      style={{ top: cardTop, left: cardLeft, width: CARD_WIDTH }}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseUp={(event) => event.stopPropagation()}
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.14)]">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2.5">
          {user?.avatarUrl ? (
            <img alt="" className="h-8 w-8 rounded-full object-cover" src={user.avatarUrl} />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
              {initials}
            </span>
          )}
          <span className="text-sm font-semibold text-slate-800">{displayName}</span>
        </div>

        <p
          className="m-0 border-b border-slate-100 px-3 py-2 text-[11px] leading-relaxed"
          style={getQuoteStripStyle(color)}
        >
          &ldquo;{selectedText}&rdquo;
        </p>

        <form className="p-3" onSubmit={handleSubmit}>
          <div className="mb-2.5">
            <p className="m-0 mb-1.5 text-[11px] font-semibold text-slate-500">Bảng màu</p>
            <WorkspaceNotebookColorPicker
              disabled={isSaving}
              onChange={onColorChange}
              value={color}
            />
          </div>

          <textarea
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            disabled={isSaving}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Viết ghi chú..."
            ref={textareaRef}
            rows={3}
            value={content}
          />
          <div className="mt-2.5 flex justify-end gap-2">
            <button
              className="cursor-pointer rounded-full border-0 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              disabled={isSaving}
              onClick={onCancel}
              type="button"
            >
              Hủy
            </button>
            <button
              className="cursor-pointer rounded-full border-0 bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!content.trim() || isSaving}
              type="submit"
            >
              {isSaving ? "Đang lưu..." : "Lưu note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
