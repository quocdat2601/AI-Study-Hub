import React, { useState } from "react";
import { ChevronDownIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "./WorkspaceIcons.jsx";
import ChatShareModal from "./ChatShareModal.jsx";

const snapshotSharingEnabled = String(import.meta.env.VITE_CHAT_SNAPSHOT_SHARING_ENABLED || "false") === "true";

function formatActivity(value) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function ChatSessionMenu({
  activeSessionId,
  busySessionId,
  error,
  isCreating,
  isLoading,
  onCreate,
  onDelete,
  onRename,
  onSelect,
  sessions,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [shareSessionId, setShareSessionId] = useState(null);
  const activeSession = sessions.find((session) => Number(session.id) === Number(activeSessionId));

  async function submitRename(event) {
    event.preventDefault();
    const title = editingTitle.trim();
    if (!title || !editingId) return;
    const renamed = await onRename(editingId, title);
    if (renamed) setEditingId(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const deleted = await onDelete(deleteTarget.id);
    if (deleted) setDeleteTarget(null);
  }

  return (
    <div className="shrink-0 border-b border-slate-200 bg-slate-50/80">
      <div className="flex h-10 items-center gap-2 px-3">
        <button
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <ChevronDownIcon className={`shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} size={14} />
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">
            {activeSession?.title || "New chat"}
          </span>
          {activeSession ? (
            <span className="shrink-0 text-[10px] font-semibold text-slate-400">
              {activeSession.attachmentCount} file{activeSession.attachmentCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </button>
        <button
          aria-label="Create new chat session"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
          disabled={isCreating}
          onClick={onCreate}
          title="New chat"
          type="button"
        >
          <PlusIcon size={14} />
        </button>
        {snapshotSharingEnabled && activeSessionId ? (
          <button
            className="h-7 rounded-md border border-indigo-200 bg-white px-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"
            onClick={() => setShareSessionId(activeSessionId)}
            type="button"
          >
            Share
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="workspace-scrollbar max-h-52 overflow-y-auto border-t border-slate-200 bg-white p-2">
          {isLoading ? (
            <div className="grid gap-1.5">
              <div className="h-11 animate-pulse rounded-md bg-slate-100" />
              <div className="h-11 animate-pulse rounded-md bg-slate-100" />
            </div>
          ) : sessions.length ? sessions.map((session) => {
            const isActive = Number(session.id) === Number(activeSessionId);
            const isBusy = Number(session.id) === Number(busySessionId);
            return (
              <div
                className={isActive
                  ? "group mb-1 flex min-h-12 items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5"
                  : "group mb-1 flex min-h-12 items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:bg-slate-50"}
                key={session.id}
              >
                {editingId === session.id ? (
                  <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={submitRename}>
                    <input
                      autoFocus
                      className="min-w-0 flex-1 rounded border border-indigo-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                      maxLength={120}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      value={editingTitle}
                    />
                    <button className="text-xs font-bold text-indigo-600" type="submit">Save</button>
                  </form>
                ) : (
                  <button
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                    disabled={isBusy}
                    onClick={() => onSelect(session.id)}
                    type="button"
                  >
                    <p className={`m-0 truncate text-xs font-bold ${isActive ? "text-indigo-700" : "text-slate-700"}`}>
                      {session.title || "New chat"}
                    </p>
                    <p className="m-0 truncate text-[10px] text-slate-400">
                      {formatActivity(session.lastActivityAt || session.updatedAt)} - {session.attachmentCount} attachment{session.attachmentCount === 1 ? "" : "s"}
                    </p>
                  </button>
                )}
                {editingId !== session.id ? (
                  <div className="flex shrink-0 items-center opacity-60 transition group-hover:opacity-100">
                    <button
                      aria-label={`Rename ${session.title || "chat"}`}
                      className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-white hover:text-indigo-600"
                      disabled={isBusy}
                      onClick={() => {
                        setEditingId(session.id);
                        setEditingTitle(session.title || "New chat");
                      }}
                      title="Rename chat"
                      type="button"
                    >
                      <PencilIcon size={13} />
                    </button>
                    <button
                      aria-label={`Delete ${session.title || "chat"}`}
                      className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600"
                      disabled={isBusy}
                      onClick={() => setDeleteTarget(session)}
                      title="Delete chat"
                      type="button"
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          }) : (
            <div className="rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">
              No chat sessions yet.
            </div>
          )}
          {error ? <p className="m-1 rounded bg-red-50 p-2 text-xs font-semibold text-red-700">{error}</p> : null}
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="delete-chat-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-sm font-bold text-slate-900" id="delete-chat-title">Delete chat?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  This removes the session and its message history. Library documents will not be deleted.
                </p>
              </div>
              <button aria-label="Close" className="text-slate-400 hover:text-slate-700" onClick={() => setDeleteTarget(null)} type="button">
                <XIcon size={16} />
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600" onClick={() => setDeleteTarget(null)} type="button">Cancel</button>
              <button className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50" disabled={Number(busySessionId) === Number(deleteTarget.id)} onClick={confirmDelete} type="button">Delete</button>
            </div>
          </div>
        </div>
      ) : null}
      {shareSessionId ? <ChatShareModal onClose={() => setShareSessionId(null)} sessionId={shareSessionId} /> : null}
    </div>
  );
}
