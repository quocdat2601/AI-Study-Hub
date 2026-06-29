import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import useDocuments from "../hooks/useDocuments.js";
import useUploadDoc from "../hooks/useUploadDoc.js";
import { formatFileSize } from "../lib/formatFileSize.js";
import { cacheWorkspaceState } from "../utils/workspaceCache.js";
import {
  deleteDocument,
  getDocumentSignedUrl,
  updateDocumentVisibility,
} from "../services/documentApi.js";
import { listSubjects } from "../services/subjectApi.js";
import EditDocumentModal from "./EditDocumentModal.jsx";
import ShareDocumentModal from "./ShareDocumentModal.jsx";

function getMimeLabel(mimeType) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType?.includes("wordprocessingml")) return "DOCX";
  if (mimeType?.startsWith("image/")) return "IMG";
  return "FILE";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function canManageDocument(doc, user) {
  if (!doc || !user) return false;
  return doc.user_id === user.id || user.role === "admin";
}

function getVisibilityLabel(doc, isOwner) {
  if (!isOwner) return "Shared";
  return doc.is_public ? "Public" : "Private";
}

function getVisibilityTone(doc, isOwner) {
  if (!isOwner) {
    return "bg-[#f2f4f6] text-[#66758a] dark:bg-slate-800 dark:text-slate-400";
  }
  if (doc.is_public) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  return "bg-[#e8f0ff] text-[#4648d4] dark:bg-indigo-950 dark:text-indigo-300";
}

function DocumentThumbnail({ doc }) {
  const label = getMimeLabel(doc.cloud_files?.mime_type);

  if (doc.thumbnailUrl) {
    return (
      <div className="h-16 w-16 flex-none overflow-hidden rounded-xl border border-[#e5e9ef] bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <img
          alt=""
          className="h-full w-full object-contain p-1"
          loading="lazy"
          src={doc.thumbnailUrl}
        />
      </div>
    );
  }

  return (
    <span className="flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-[#fee2e2] text-xs font-black text-[#ef4444] dark:bg-red-950 dark:text-red-300">
      {label}
    </span>
  );
}

function ActionButton({ children, disabled = false, onClick, tone = "default" }) {
  const tones = {
    default: "border-[#dbe3ed] bg-white text-[#4648d4] hover:bg-[#f8faff] dark:border-slate-600 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700",
    muted: "border-[#dbe3ed] bg-white text-[#344154] hover:bg-[#f8fafc] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
    share: "border-[#b8e8df] bg-[#f0fdf9] text-[#0f766e] hover:bg-[#e6faf4] dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900",
    danger: "border-[#fecaca] bg-[#fff5f5] text-[#b42318] hover:bg-[#ffecec] dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900",
  };

  return (
    <button
      className={`rounded-lg border px-3 py-1.5 text-xs font-bold cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function VisibilityToggleButton({ doc, disabled, onClick }) {
  const isPublic = Boolean(doc.is_public);
  const statusClass = isPublic
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800"
    : "bg-indigo-50 text-[#4648d4] ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800";
  const knobClass = isPublic ? "translate-x-4 bg-emerald-500" : "translate-x-0 bg-[#4648d4]";

  return (
    <button
      className={`group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ring-1 transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${statusClass}`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      title={isPublic ? "Click to make this document private" : "Click to publish this document"}
      type="button"
    >
      <span className="relative h-4 w-8 rounded-full bg-white/80 ring-1 ring-black/5 dark:bg-slate-900/80">
        <span className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full transition-transform ${knobClass}`} />
      </span>
      <span>{disabled ? "Saving..." : isPublic ? "Public" : "Private"}</span>
      <span className="hidden font-bold opacity-65 transition group-hover:opacity-100 sm:inline">
        {isPublic ? "Make private" : "Publish"}
      </span>
    </button>
  );
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [editingDoc, setEditingDoc] = useState(null);
  const [sharingDoc, setSharingDoc] = useState(null);
  const [updatingVisibilityId, setUpdatingVisibilityId] = useState(null);
  const [actionError, setActionError] = useState("");

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      subjectId: subjectFilter || undefined,
    }),
    [search, subjectFilter]
  );

  const { documents, isLoading, error, reload } = useDocuments(queryParams);
  const uploadDoc = useUploadDoc({ onUploaded: () => reload() });

  const ownedCount = documents.filter((doc) => canManageDocument(doc, user)).length;
  const sharedCount = documents.length - ownedCount;

  const loadSubjects = useCallback(async () => {
    try {
      setSubjects(await listSubjects());
    } catch {
      setSubjects([]);
    }
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  function handlePreview(doc) {
    setActionError("");
    cacheWorkspaceState({ selectedId: doc.id });
    navigate(`/workspace/documents/${doc.id}`);
  }

  async function handleDownload(doc) {
    setActionError("");
    try {
      const { signedUrl } = await getDocumentSignedUrl(doc.id);
      const link = window.document.createElement("a");
      link.href = signedUrl;
      link.download = doc.title || "document";
      link.click();
    } catch (err) {
      const message = err.response?.data?.error || "Could not download file.";
      setActionError(message);
      addToast({ type: "error", title: "Download failed", message });
    }
  }

  async function handleDelete(doc) {
    const ok = window.confirm(
      `Move "${doc.title}" to trash? You can restore it from Trash within 30 days.`
    );
    if (!ok) return;

    setActionError("");
    try {
      await deleteDocument(doc.id);
      addToast({
        type: "success",
        title: "Moved to trash",
        message: `"${doc.title}" was moved to trash. Restore it from Trash within 30 days.`,
      });
      reload();
    } catch (err) {
      const message = err.response?.data?.error || "Could not move document to trash.";
      setActionError(message);
      addToast({ type: "error", title: "Delete failed", message });
    }
  }

  async function handleToggleVisibility(doc) {
    const nextIsPublic = !doc.is_public;
    setActionError("");
    setUpdatingVisibilityId(doc.id);

    try {
      await updateDocumentVisibility(doc.id, nextIsPublic);
      addToast({
        type: "success",
        title: nextIsPublic ? "Document is public" : "Document is private",
        message: `"${doc.title}" was updated.`,
      });
      reload();
    } catch (err) {
      const message = err.response?.data?.error || "Could not update visibility.";
      setActionError(message);
      addToast({ type: "error", title: "Visibility update failed", message });
    } finally {
      setUpdatingVisibilityId(null);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-[1280px]">
        <section className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#4648d4] to-[#6366f1] p-6 text-white shadow-[0_12px_30px_rgba(70,72,212,0.25)] md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-widest text-white/75">Documents</p>
              <h1 className="m-0 mt-2 text-3xl font-bold">My Study Library</h1>
              <p className="m-0 mt-2 max-w-2xl text-sm text-white/90">
                Upload, organize, share and manage your PDF study materials in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
                to="/documents/trash"
              >
                🗑️ Trash
              </Link>
              <button
                className="inline-flex items-center gap-2 rounded-xl border-0 bg-white px-5 py-3 text-sm font-bold text-[#4648d4] cursor-pointer shadow-[0_8px_20px_rgba(15,23,42,0.15)]"
                onClick={uploadDoc.open}
                type="button"
              >
                <span className="text-lg leading-none">+</span>
                Upload Document
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl bg-white/12 px-4 py-3 backdrop-blur-sm">
              <p className="m-0 text-xs text-white/75">Total documents</p>
              <strong className="text-2xl">{documents.length}</strong>
            </article>
            <article className="rounded-xl bg-white/12 px-4 py-3 backdrop-blur-sm">
              <p className="m-0 text-xs text-white/75">Owned by you</p>
              <strong className="text-2xl">{ownedCount}</strong>
            </article>
            <article className="rounded-xl bg-white/12 px-4 py-3 backdrop-blur-sm">
              <p className="m-0 text-xs text-white/75">Shared with you</p>
              <strong className="text-2xl">{sharedCount}</strong>
            </article>
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-[#e5e9ef] bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <input
              className="rounded-xl border border-[#dbe3ed] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or tag..."
              value={search}
            />
            <select
              className="rounded-xl border border-[#dbe3ed] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#4648d4] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              onChange={(event) => setSubjectFilter(event.target.value)}
              value={subjectFilter}
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {(error || actionError) ? (
          <div className="mb-5 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-bold text-[#b42318] dark:bg-red-950/40 dark:text-red-300">
            {error || actionError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-[#e5e9ef] bg-white p-10 text-center text-[#66758a] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Loading your documents...
          </div>
        ) : documents.length ? (
          <div className="grid gap-4">
            {documents.map((doc) => {
              const isOwner = canManageDocument(doc, user);
              return (
                <article
                  className="cursor-pointer rounded-2xl border border-[#e5e9ef] bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-lg dark:hover:shadow-black/20"
                  key={doc.id}
                  onClick={() => handlePreview(doc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handlePreview(doc);
                    }
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <DocumentThumbnail doc={doc} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="m-0 truncate text-base font-bold text-[#172033] dark:text-slate-100">{doc.title}</h2>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${getVisibilityTone(doc, isOwner)}`}
                          >
                            {getVisibilityLabel(doc, isOwner)}
                          </span>
                        </div>
                        <p className="m-0 mt-1 text-sm text-[#66758a] dark:text-slate-400">
                          {doc.subjects?.name || "No subject"} · {formatDate(doc.created_at)} · {formatFileSize(doc.cloud_files?.size_bytes)}
                        </p>
                        {doc.tags?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {doc.tags.map((tag) => (
                              <span
                                className="inline-flex rounded-full bg-[#f2f4f6] px-2.5 py-0.5 text-xs font-bold text-[#66758a] dark:bg-slate-800 dark:text-slate-400"
                                key={tag.id}
                              >
                                #{tag.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ActionButton onClick={() => handlePreview(doc)}>Preview</ActionButton>
                      <ActionButton onClick={() => handleDownload(doc)}>Download</ActionButton>
                      {isOwner ? (
                        <>
                          <ActionButton onClick={() => setEditingDoc(doc)} tone="muted">Edit</ActionButton>
                          <VisibilityToggleButton
                            doc={doc}
                            disabled={updatingVisibilityId === doc.id}
                            onClick={() => handleToggleVisibility(doc)}
                          />
                          <ActionButton onClick={() => setSharingDoc(doc)} tone="share">Share</ActionButton>
                          <ActionButton onClick={() => handleDelete(doc)} tone="danger">Delete</ActionButton>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#c7d2fe] bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0ff] text-2xl text-[#4648d4] dark:bg-indigo-950 dark:text-indigo-300">
              📄
            </span>
            <h2 className="m-0 text-lg font-bold text-[#172033] dark:text-slate-100">No documents yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#66758a] dark:text-slate-400">
              Upload your first PDF or DOCX to start building your study library.
            </p>
            <button
              className="mt-5 rounded-xl border-0 bg-[#4648d4] px-5 py-3 text-sm font-bold text-white cursor-pointer"
              onClick={uploadDoc.open}
              type="button"
            >
              Upload your first document
            </button>
          </div>
        )}
      </div>

      <EditDocumentModal
        document={editingDoc}
        isOpen={Boolean(editingDoc)}
        subjects={subjects}
        onClose={() => setEditingDoc(null)}
        onSuccess={() => {
          addToast({
            type: "success",
            title: "Document updated",
            message: "Changes saved successfully.",
          });
          reload();
        }}
      />

      <ShareDocumentModal
        document={sharingDoc}
        isOpen={Boolean(sharingDoc)}
        onClose={() => setSharingDoc(null)}
        onSuccess={() => {
          addToast({
            type: "success",
            title: "Share updated",
            message: "Document sharing settings were saved.",
          });
          reload();
        }}
      />
    </DashboardShell>
  );
}
