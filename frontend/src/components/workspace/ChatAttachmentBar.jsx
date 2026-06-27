import React, { useEffect, useMemo, useRef, useState } from "react";
import { UPLOAD_DOC_ACCEPT_ATTR, getUploadDocFileLabel } from "../../services/uploadDocApi.js";
import { getRecoverableAttachmentPresentation } from "../../utils/chatAttachments.js";
import { BookmarkIcon, ClockIcon, FileTextIcon, PlusIcon, RefreshIcon, UploadIcon, XIcon } from "./WorkspaceIcons.jsx";

const MAX_ATTACHMENTS = 20;

function isImageAttachment(attachment) {
  const fileType = String(attachment?.fileType || attachment?.file_type || "").toUpperCase();
  const title = String(attachment?.title || "");
  return fileType === "IMAGE"
    || Boolean(attachment?.thumbnailUrl && /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(title))
    || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(title);
}

function fileTypeLabelFromTitle(title, fallback = "FILE") {
  const lower = String(title || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".docx")) return "DOCX";
  if (lower.endsWith(".txt")) return "TXT";
  if (/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(lower)) return "IMG";
  return fallback;
}

function activeFileTypeLabel(attachment) {
  if (isImageAttachment(attachment)) return "IMG";
  const fileType = String(attachment?.fileType || "").toUpperCase();
  if (["PDF", "DOCX", "TXT"].includes(fileType)) return fileType;
  return fileTypeLabelFromTitle(attachment?.title, fileType || "FILE");
}

function typeBadgeClass(label) {
  if (label === "PDF") return "border-red-100 bg-red-50 text-red-600";
  if (label === "DOCX") return "border-blue-100 bg-blue-50 text-blue-600";
  if (label === "TXT") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (label === "IMG") return "border-violet-100 bg-violet-50 text-violet-700";
  return "border-slate-100 bg-slate-50 text-slate-500";
}

function FileTypeBadge({ label }) {
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[9px] font-black ${typeBadgeClass(label)}`}>
      {label}
    </span>
  );
}

function ImageThumb({ alt, onOpen, src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <FileTypeBadge label="IMG" />;
  return (
    <button
      aria-label={`Preview ${alt}`}
      className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-0 transition hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      onClick={onOpen}
      type="button"
    >
      <img
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
        src={src}
      />
    </button>
  );
}

function ImageLightbox({ image, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!image) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousActive = document.activeElement;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const focusable = Array.from(document.querySelectorAll("[data-image-lightbox] button"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus?.();
    };
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4"
      data-image-lightbox
      role="dialog"
    >
      <button aria-label="Close image preview" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <p className="m-0 min-w-0 truncate text-sm font-bold text-slate-800" title={image.title}>{image.title}</p>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <XIcon size={14} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100 p-3">
          <img alt={image.title} className="max-h-[78vh] max-w-full object-contain" src={image.url} />
        </div>
      </div>
    </div>
  );
}

function isExpired(document) {
  return document?.lifecycleStatus === "expired"
    || (document?.expiresAt && new Date(document.expiresAt).getTime() <= Date.now());
}

function formatRecoveryDeadline(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function actionMatches(action, type, documentId) {
  return action?.type === type
    && (documentId === undefined || Number(action.documentId) === Number(documentId));
}

function AttachmentCard({ attachment, action, onDeleteRecoverable, onOpenImage, onRemove, onRestore, onSave, primaryDocumentId, recoverable = false }) {
  const expired = isExpired(attachment);
  const recovery = getRecoverableAttachmentPresentation(attachment);
  const isPurging = recovery.isPurging;
  const isPurged = attachment.lifecycleStatus === "purged";
  const canRestore = recovery.showRestore && !isPurged;
  const isRemoving = actionMatches(action, "remove", attachment.id);
  const isRestoring = actionMatches(action, "restore", attachment.id);
  const isSaving = actionMatches(action, "save", attachment.id);
  const isDeleting = actionMatches(action, "delete-recoverable", attachment.id);
  const isTemporary = attachment.documentScope === "session";
  const isPrimary = !recoverable && Number(attachment.id) === Number(primaryDocumentId);
  const fileLabel = activeFileTypeLabel(attachment);
  const imageUrl = isImageAttachment(attachment) ? attachment.thumbnailUrl : null;

  return (
    <div className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 ${recoverable ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-white"}`}>
      {imageUrl ? (
        <ImageThumb alt={attachment.title} onOpen={() => onOpenImage({ title: attachment.title, url: imageUrl })} src={imageUrl} />
      ) : (
        <FileTypeBadge label={fileLabel} />
      )}
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-xs font-bold text-slate-800" title={attachment.title}>{attachment.title}</p>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-slate-500">
          <span>
            {isPurged
              ? "Permanently removed"
              : isPurging
                ? "Cleanup in progress"
                : expired
                  ? `Expired${formatRecoveryDeadline(attachment.purgeAfter) ? ` - recover by ${formatRecoveryDeadline(attachment.purgeAfter)}` : ""}`
                  : recoverable
                    ? recovery.statusLabel
                    : isPrimary
                      ? "Current"
                      : isTemporary
                        ? "Temporary"
                        : "My Documents"}
          </span>
          {!recoverable && attachment.extractionStatus === "pending" ? <span className="text-amber-600">Processing</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {recoverable ? (
          <>
            {isTemporary && !isPurged ? (
              <button
                aria-label={`Save ${attachment.title} to My Documents`}
                className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold text-indigo-600 hover:bg-white disabled:opacity-50"
                disabled={isSaving || isRestoring || isPurging}
                onClick={() => onSave(attachment)}
                title="Save to My Documents"
                type="button"
              >
                {isSaving ? <ClockIcon size={12} /> : <BookmarkIcon size={12} />}
                Save
              </button>
            ) : null}
            <button
              aria-label={`Restore ${attachment.title}`}
              className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold text-indigo-600 hover:bg-white disabled:opacity-50"
              disabled={!canRestore || isRestoring || isSaving || isDeleting}
              onClick={() => onRestore(attachment)}
              title={isPurged ? "This attachment was permanently removed" : isPurging ? "Cleanup is in progress" : "Restore attachment"}
              type="button"
            >
              {isRestoring ? <ClockIcon size={12} /> : <RefreshIcon size={12} />}
              Restore
            </button>
            <button
              aria-label={`Permanently delete ${attachment.title}`}
              className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold text-red-600 hover:bg-white disabled:opacity-50"
              disabled={!canRestore || isRestoring || isSaving || isDeleting || isPurging}
              onClick={() => onDeleteRecoverable(attachment)}
              title="Delete permanently"
              type="button"
            >
              {isDeleting ? <ClockIcon size={12} /> : <XIcon size={12} />}
              Delete
            </button>
          </>
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

function PendingAttachmentCard({ item, onOpenImage, onRemove, onRetry, previewUrl }) {
  const busy = ["queued", "uploading", "processing"].includes(item.status);
  const failed = item.status === "failed";
  const isImage = item.file?.type?.startsWith("image/");
  const labelName = getUploadDocFileLabel(item.file);
  const label = item.status === "queued"
    ? "Queued"
    : item.status === "uploading"
      ? `${item.progress || 0}% uploaded`
      : item.status === "processing"
        ? "Processing"
        : failed ? "Failed - not included in your next question" : "Ready";
  return (
    <div className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 ${failed ? "border-red-200 bg-red-50/70" : "border-slate-200 bg-white"}`}>
      {isImage && previewUrl ? (
        <ImageThumb alt={item.file.name} onOpen={() => onOpenImage({ title: item.file.name, url: previewUrl })} src={previewUrl} />
      ) : (
        <FileTypeBadge label={labelName} />
      )}
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-xs font-bold text-slate-800" title={item.file.name}>{item.file.name}</p>
        <p className={failed ? "m-0.5 text-[10px] font-semibold text-red-700" : "m-0.5 text-[10px] font-semibold text-slate-500"}>{labelName} - {label}</p>
        {busy ? <div className="mt-1 h-1 overflow-hidden rounded-full bg-white"><span className="block h-full bg-indigo-600 transition-[width]" style={{ width: `${Math.max(5, item.progress || 0)}%` }} /></div> : null}
        {failed && item.error ? <p className="m-0.5 truncate text-[10px] text-red-600" title={item.error}>{item.error}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {failed ? <button className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold text-indigo-600 hover:bg-white" onClick={() => onRetry(item.id)} type="button"><RefreshIcon size={12} />Retry</button> : null}
        <button aria-label={`Remove ${item.file.name}`} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-red-600" onClick={() => onRemove(item.id)} title="Remove file" type="button"><XIcon size={13} /></button>
      </div>
    </div>
  );
}

export default function ChatAttachmentBar({
  action,
  activeAttachments = [],
  availableDocuments = [],
  dragDropAttachmentsEnabled = false,
  error,
  isLoading,
  onAttach,
  onCancelUpload,
  onClearPending,
  onDeleteRecoverable,
  onDeleteAllRecoverable,
  onRemove,
  onRemoveTemporary,
  onRemoveQueued,
  onRestore,
  onRetryQueued,
  onSave,
  onUpload,
  primaryDocumentId,
  pendingItems = [],
  recoverableAttachments = [],
  sessionId,
  uploadProgress,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [pendingPreviewUrls, setPendingPreviewUrls] = useState({});
  const [search, setSearch] = useState("");
  const fileInputRef = useRef(null);
  const pendingPreviewUrlsRef = useRef(pendingPreviewUrls);
  const attachedIds = useMemo(
    () => new Set(
      [...activeAttachments, ...recoverableAttachments]
        .map((attachment) => Number(attachment.id))
    ),
    [activeAttachments, recoverableAttachments]
  );
  const choices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return availableDocuments.filter((document) => (
      !attachedIds.has(Number(document.id))
      && (!term || String(document.title || "").toLowerCase().includes(term))
    ));
  }, [attachedIds, availableDocuments, search]);
  const pendingReservationCount = pendingItems.filter((item) => ["queued", "uploading", "processing"].includes(item.status)).length;
  const pendingActiveCount = pendingItems.length;
  const isUploading = action?.type === "upload";
  const failedCount = pendingItems.filter((item) => item.status === "failed").length;
  const uploadingCount = pendingItems.filter((item) => ["queued", "uploading", "processing"].includes(item.status)).length + (isUploading ? 1 : 0);
  const totalVisibleCount = activeAttachments.length + recoverableAttachments.length + pendingActiveCount;
  const atLimit = activeAttachments.length + pendingReservationCount >= MAX_ATTACHMENTS;
  const isBusy = Boolean(action);
  const isBulkRemoving = action?.type === "remove-temporary";
  const isDeletingRecoverable = action?.type === "delete-recoverable-all";
  const clearablePendingCount = pendingItems.filter((item) => ["queued", "uploading", "processing", "failed"].includes(item.status)).length;
  const removableTemporaryAttachments = activeAttachments.filter((attachment) => (
    attachment.documentScope === "session"
    && Number(attachment.id) !== Number(primaryDocumentId)
  ));
  const summaryText = totalVisibleCount
    ? `${totalVisibleCount} file${totalVisibleCount === 1 ? "" : "s"}${uploadingCount ? ` - Uploading ${uploadingCount}` : failedCount ? ` - ${failedCount} failed` : ""}`
    : "No files";

  useEffect(() => {
    pendingPreviewUrlsRef.current = pendingPreviewUrls;
  }, [pendingPreviewUrls]);

  useEffect(() => {
    const imageItems = pendingItems.filter((item) => item.file?.type?.startsWith("image/"));
    const nextIds = new Set(imageItems.map((item) => item.id));

    setPendingPreviewUrls((current) => {
      let changed = false;
      const next = {};
      for (const item of imageItems) {
        next[item.id] = current[item.id] || URL.createObjectURL(item.file);
        if (!current[item.id]) changed = true;
      }
      for (const [id, url] of Object.entries(current)) {
        if (!nextIds.has(id)) {
          URL.revokeObjectURL(url);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [pendingItems]);

  useEffect(() => () => {
    for (const url of Object.values(pendingPreviewUrlsRef.current)) {
      URL.revokeObjectURL(url);
    }
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setIsMoreOpen(false);
    setSearch("");
  }, [sessionId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  async function chooseDocument(document) {
    if (await onAttach(document)) setIsOpen(false);
  }

  async function chooseUpload(event) {
    const files = dragDropAttachmentsEnabled ? Array.from(event.target.files || []) : [event.target.files?.[0]].filter(Boolean);
    event.target.value = "";
    if (!files.length) return;
    if (await onUpload(dragDropAttachmentsEnabled ? files : files[0])) setIsOpen(false);
  }

  async function clearPendingUploads() {
    setIsMoreOpen(false);
    await onClearPending?.();
  }

  async function removeTemporaryAttachments() {
    if (!removableTemporaryAttachments.length) return;
    const confirmed = window.confirm(
      `Remove ${removableTemporaryAttachments.length} temporary attachment${removableTemporaryAttachments.length === 1 ? "" : "s"} from this chat?\n\nThe primary document and files saved to My Documents will not be affected. Existing chat messages will remain, but these files will no longer be available for new questions.`
    );
    if (!confirmed) return;
    setIsMoreOpen(false);
    await onRemoveTemporary?.();
  }

  async function deleteRecoverableAttachment(attachment) {
    const confirmed = window.confirm(
      "Permanently delete this recoverable attachment?\n\nIt will no longer be restorable from this chat. Saved copies and files referenced elsewhere will not be affected."
    );
    if (!confirmed) return;
    await onDeleteRecoverable?.(attachment);
  }

  async function deleteAllRecoverableAttachments() {
    if (!recoverableAttachments.length) return;
    const confirmed = window.confirm(
      `Permanently remove ${recoverableAttachments.length} recoverable attachment${recoverableAttachments.length === 1 ? "" : "s"} from this chat?\n\nThey will no longer be restorable. Saved copies and files still referenced elsewhere will not be affected.`
    );
    if (!confirmed) return;
    setIsMoreOpen(false);
    await onDeleteAllRecoverable?.();
  }

  return (
    <>
    <section className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          aria-expanded={isOpen}
          className="flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <FileTextIcon className="shrink-0 text-indigo-600" size={13} />
          <span className="truncate text-[11px] font-bold text-slate-700">{summaryText}</span>
          <span className={`shrink-0 text-[10px] font-bold ${atLimit ? "text-amber-600" : "text-slate-400"}`}>{activeAttachments.length + pendingReservationCount}/{MAX_ATTACHMENTS}</span>
        </button>
        <button
          className="flex h-7 items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 text-[11px] font-bold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!sessionId || atLimit || isBusy || isLoading}
          onClick={() => setIsOpen(true)}
          title={atLimit ? "This chat already has 20 active documents" : "Add a file to this chat"}
          type="button"
        >
          <PlusIcon size={12} />
          Add file
        </button>
      </div>

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
    </section>

      {isOpen ? (
        <div aria-modal="true" className="absolute inset-0 z-40 flex justify-end bg-slate-900/20 backdrop-blur-[1px]" role="dialog">
          <button aria-label="Close attachments drawer" className="absolute inset-0 cursor-default" onClick={() => setIsOpen(false)} type="button" />
          <div className="relative flex h-full w-full max-w-[380px] flex-col border-l border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.22)]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="m-0 text-base font-bold text-slate-900">Attachments</h3>
                <p className="m-0 text-xs font-semibold text-slate-500">{activeAttachments.length + pendingReservationCount}/{MAX_ATTACHMENTS} active documents</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    aria-expanded={isMoreOpen}
                    className="h-8 rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-45"
                    disabled={isBulkRemoving}
                    onClick={() => setIsMoreOpen((current) => !current)}
                    type="button"
                  >
                    {isBulkRemoving ? "Removing..." : "More"}
                  </button>
                  {isMoreOpen ? (
                    <div className="absolute right-0 top-9 z-50 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
                      <button
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={!clearablePendingCount || isBusy}
                        onClick={clearPendingUploads}
                        type="button"
                      >
                        <span>Clear pending uploads</span>
                        <span className="text-slate-400">{clearablePendingCount || ""}</span>
                      </button>
                      <button
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={!removableTemporaryAttachments.length || isBusy}
                        onClick={removeTemporaryAttachments}
                        type="button"
                      >
                        <span>Remove all temporary attachments</span>
                        <span className="text-red-300">{removableTemporaryAttachments.length || ""}</span>
                      </button>
                      <button
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={!recoverableAttachments.length || isBusy}
                        onClick={deleteAllRecoverableAttachments}
                        type="button"
                      >
                        <span>{isDeletingRecoverable ? "Removing recoverable..." : "Remove all recoverable files"}</span>
                        <span className="text-red-300">{recoverableAttachments.length || ""}</span>
                      </button>
                    </div>
                  ) : null}
                </div>
                <button className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" onClick={() => setIsOpen(false)} type="button">
                  <XIcon size={14} />
                </button>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 p-3">
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
            <input accept={UPLOAD_DOC_ACCEPT_ATTR} className="hidden" multiple={dragDropAttachmentsEnabled} onChange={chooseUpload} ref={fileInputRef} type="file" />
          </div>

            <div className="workspace-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {isLoading ? <div className="h-14 animate-pulse rounded-xl bg-slate-100" /> : null}
              {pendingItems.map((item) => (
                <PendingAttachmentCard
                  item={item}
                  key={item.id}
                  onOpenImage={setLightboxImage}
                  onRemove={onRemoveQueued}
                  onRetry={onRetryQueued}
                  previewUrl={pendingPreviewUrls[item.id]}
                />
              ))}
              {activeAttachments.map((attachment) => (
                <AttachmentCard attachment={attachment} action={action} key={attachment.id} onDeleteRecoverable={deleteRecoverableAttachment} onOpenImage={setLightboxImage} onRemove={onRemove} onRestore={onRestore} onSave={onSave} primaryDocumentId={primaryDocumentId} />
              ))}
              {recoverableAttachments.length ? <p className="m-0 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Recoverable</p> : null}
              {recoverableAttachments.map((attachment) => (
                <AttachmentCard attachment={attachment} action={action} key={`recoverable-${attachment.id}`} onDeleteRecoverable={deleteRecoverableAttachment} onOpenImage={setLightboxImage} onRemove={onRemove} onRestore={onRestore} onSave={onSave} primaryDocumentId={primaryDocumentId} recoverable />
              ))}
              {!isLoading && !pendingItems.length && !activeAttachments.length && !recoverableAttachments.length ? (
                <p className="m-0 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">No files attached to this chat.</p>
              ) : null}

              <div className="pt-2">
                <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Add existing document</p>
              </div>
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
        </div>
      ) : null}
      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  );
}
