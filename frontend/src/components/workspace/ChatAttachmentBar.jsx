import React, { useEffect, useMemo, useRef, useState } from "react";
import { UPLOAD_DOC_ACCEPT_ATTR } from "../../services/uploadDocApi.js";
import { BookmarkIcon, ClockIcon, FileTextIcon, PlusIcon, RefreshIcon, UploadIcon, XIcon } from "./WorkspaceIcons.jsx";

const MAX_ATTACHMENTS = 10;

function isExpired(document) {
  return document?.lifecycleStatus === "expired"
    || (document?.expiresAt && new Date(document.expiresAt).getTime() <= Date.now());
}

function actionMatches(action, type, documentId) {
  return action?.type === type
    && (documentId === undefined || Number(action.documentId) === Number(documentId));
}

function AttachmentCard({ attachment, action, onRemove, onRestore, onSave, primaryDocumentId, removed = false }) {
  const expired = isExpired(attachment);
  const isRemoving = actionMatches(action, "remove", attachment.id);
  const isRestoring = actionMatches(action, "restore", attachment.id);
  const isSaving = actionMatches(action, "save", attachment.id);
  const isTemporary = attachment.documentScope === "session";
  const isPrimary = !removed && Number(attachment.id) === Number(primaryDocumentId);

  return (
    <div className={`flex min-w-[210px] max-w-[260px] items-center gap-2 rounded-lg border px-2.5 py-2 ${removed ? "border-slate-200 bg-slate-50 opacity-80" : "border-indigo-100 bg-indigo-50/60"}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${removed ? "bg-slate-200 text-slate-500" : "bg-white text-indigo-600"}`}>
        <FileTextIcon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[11px] font-bold text-slate-800" title={attachment.title}>{attachment.title}</p>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-slate-500">
          <span>{expired ? "Expired" : removed ? "Removed" : isPrimary ? "Current" : isTemporary ? "Temporary" : "My Documents"}</span>
          {!removed && attachment.extractionStatus === "pending" ? <span className="text-amber-600">Processing</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {removed ? (
          <button
            aria-label={`Restore ${attachment.title}`}
            className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold text-indigo-600 hover:bg-white disabled:opacity-50"
            disabled={expired || isRestoring}
            onClick={() => onRestore(attachment)}
            title={expired ? "This attachment has expired" : "Restore attachment"}
            type="button"
          >
            {isRestoring ? <ClockIcon size={12} /> : <RefreshIcon size={12} />}
            Restore
          </button>
        ) : (
          <>
            {isTemporary ? (
              <button
                aria-label={`Save ${attachment.title} to My Documents`}
                className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold text-indigo-600 hover:bg-white disabled:opacity-50"
                disabled={isSaving || isRemoving}
                onClick={() => onSave(attachment)}
                title="Save to My Documents"
                type="button"
              >
                {isSaving ? <ClockIcon size={12} /> : <BookmarkIcon size={12} />}
                Save
              </button>
            ) : null}
            <button
              aria-label={`Remove ${attachment.title}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-red-600 disabled:opacity-50"
              disabled={isPrimary || isRemoving || isSaving}
              onClick={() => onRemove(attachment)}
              title={isPrimary ? "The current RAG document cannot be removed yet" : "Remove from this chat"}
              type="button"
            >
              {isRemoving ? <ClockIcon size={12} /> : <XIcon size={13} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatAttachmentBar({
  action,
  activeAttachments = [],
  availableDocuments = [],
  error,
  isLoading,
  onAttach,
  onCancelUpload,
  onRemove,
  onRestore,
  onSave,
  onUpload,
  primaryDocumentId,
  removedAttachments = [],
  sessionId,
  uploadProgress,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef(null);
  const activeIds = useMemo(
    () => new Set(activeAttachments.map((attachment) => Number(attachment.id))),
    [activeAttachments]
  );
  const choices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return availableDocuments.filter((document) => (
      !activeIds.has(Number(document.id))
      && (!term || String(document.title || "").toLowerCase().includes(term))
    ));
  }, [activeIds, availableDocuments, search]);
  const atLimit = activeAttachments.length >= MAX_ATTACHMENTS;
  const isUploading = action?.type === "upload";
  const isBusy = Boolean(action);

  useEffect(() => {
    setIsOpen(false);
    setSearch("");
  }, [sessionId]);

  async function chooseDocument(document) {
    if (await onAttach(document)) setIsOpen(false);
  }

  async function chooseUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (await onUpload(file)) setIsOpen(false);
  }

  return (
    <section className="relative shrink-0 border-b border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-bold text-slate-600">Files</span>
          <span className={`text-[10px] font-bold ${atLimit ? "text-amber-600" : "text-slate-400"}`}>{activeAttachments.length}/{MAX_ATTACHMENTS}</span>
        </div>
        <button
          className="flex h-7 items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 text-[11px] font-bold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!sessionId || atLimit || isBusy || isLoading}
          onClick={() => setIsOpen((current) => !current)}
          title={atLimit ? "This chat already has 10 active files" : "Add a file to this chat"}
          type="button"
        >
          <PlusIcon size={12} />
          Add file
        </button>
      </div>

      {isLoading ? (
        <div className="mt-2 h-11 animate-pulse rounded-lg bg-slate-100" />
      ) : activeAttachments.length || removedAttachments.length ? (
        <div className="workspace-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          {activeAttachments.map((attachment) => (
            <AttachmentCard attachment={attachment} action={action} key={attachment.id} onRemove={onRemove} onRestore={onRestore} onSave={onSave} primaryDocumentId={primaryDocumentId} />
          ))}
          {removedAttachments.map((attachment) => (
            <AttachmentCard attachment={attachment} action={action} key={`removed-${attachment.id}`} onRemove={onRemove} onRestore={onRestore} onSave={onSave} primaryDocumentId={primaryDocumentId} removed />
          ))}
        </div>
      ) : (
        <p className="m-0 mt-1 text-[10px] text-slate-400">No files attached to this chat.</p>
      )}

      {isUploading ? (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
            <span className="block h-full bg-indigo-600 transition-[width]" style={{ width: `${Math.max(4, uploadProgress)}%` }} />
          </div>
          <span className="text-[10px] font-bold text-slate-500">{uploadProgress >= 100 ? "Processing" : `${uploadProgress}%`}</span>
          <button className="text-[10px] font-bold text-red-600 hover:underline" onClick={onCancelUpload} type="button">Cancel</button>
        </div>
      ) : null}

      {action?.type === "attach" ? <p className="m-0 mt-2 text-[10px] font-semibold text-indigo-600">Adding file...</p> : null}

      {error ? <p className="m-0 mt-2 rounded-md bg-red-50 px-2 py-1.5 text-[10px] font-semibold text-red-700">{error}</p> : null}

      {isOpen ? (
        <div className="absolute left-2 right-2 top-full z-40 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.18)]">
          <div className="flex items-center gap-2 border-b border-slate-100 p-2">
            <input
              className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-indigo-400"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a document"
              value={search}
            />
            <button className="flex h-8 shrink-0 items-center gap-1 rounded-md bg-indigo-600 px-2.5 text-[11px] font-bold text-white hover:bg-indigo-700" onClick={() => fileInputRef.current?.click()} type="button">
              <UploadIcon size={12} />
              Upload new
            </button>
            <input accept={UPLOAD_DOC_ACCEPT_ATTR} className="hidden" onChange={chooseUpload} ref={fileInputRef} type="file" />
          </div>
          <div className="workspace-scrollbar max-h-52 overflow-y-auto p-1.5">
            {choices.length ? choices.map((document) => (
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
                disabled={isBusy}
                key={document.id}
                onClick={() => chooseDocument(document)}
                type="button"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500"><FileTextIcon size={13} /></span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{document.title}</span>
                <PlusIcon className="text-indigo-500" size={12} />
              </button>
            )) : (
              <p className="m-0 px-2 py-4 text-center text-xs text-slate-400">No other documents available.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
