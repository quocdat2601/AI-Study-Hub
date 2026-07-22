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
import { removeBookmark } from "../services/bookmarkApi.js";
import EditDocumentModal from "./EditDocumentModal.jsx";
import ShareDocumentModal from "./ShareDocumentModal.jsx";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMimeLabel(mimeType) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType?.includes("wordprocessingml")) return "DOCX";
  if (mimeType?.startsWith("image/")) return "IMG";
  return "FILE";
}

function getMimeColor(mimeType) {
  if (mimeType === "application/pdf")
    return "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300";
  if (mimeType?.includes("wordprocessingml"))
    return "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300";
  if (mimeType?.startsWith("image/"))
    return "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-300";
  return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
}

function formatDate(value) {
  if (!value) return "—";
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

function isBookmarkedDocument(doc, isOwner) {
  return !isOwner && doc?.access_via === "bookmark";
}

// ─── MAJOR colour palette ────────────────────────────────────────────────────

const MAJOR_PALETTE = {
  CNTT: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800",
    icon: "🖥️",
    accent: "text-violet-700 dark:text-violet-300",
    chip: "bg-violet-100 text-violet-700 ring-violet-300 dark:bg-violet-900 dark:text-violet-200 dark:ring-violet-700",
    chipActive: "bg-violet-600 text-white ring-violet-600",
    dot: "bg-violet-500",
  },
  QTKD: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    icon: "📊",
    accent: "text-amber-700 dark:text-amber-300",
    chip: "bg-amber-100 text-amber-700 ring-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:ring-amber-700",
    chipActive: "bg-amber-600 text-white ring-amber-600",
    dot: "bg-amber-500",
  },
  TRUYENTHONG: {
    bg: "bg-pink-50 dark:bg-pink-950/40",
    border: "border-pink-200 dark:border-pink-800",
    icon: "📡",
    accent: "text-pink-700 dark:text-pink-300",
    chip: "bg-pink-100 text-pink-700 ring-pink-300 dark:bg-pink-900 dark:text-pink-200 dark:ring-pink-700",
    chipActive: "bg-pink-600 text-white ring-pink-600",
    dot: "bg-pink-500",
  },
  NGONNGU: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-200 dark:border-teal-800",
    icon: "🌐",
    accent: "text-teal-700 dark:text-teal-300",
    chip: "bg-teal-100 text-teal-700 ring-teal-300 dark:bg-teal-900 dark:text-teal-200 dark:ring-teal-700",
    chipActive: "bg-teal-600 text-white ring-teal-600",
    dot: "bg-teal-500",
  },
  LUAT: {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800",
    icon: "⚖️",
    accent: "text-orange-700 dark:text-orange-300",
    chip: "bg-orange-100 text-orange-700 ring-orange-300 dark:bg-orange-900 dark:text-orange-200 dark:ring-orange-700",
    chipActive: "bg-orange-600 text-white ring-orange-600",
    dot: "bg-orange-500",
  },
  OTHER: {
    bg: "bg-slate-50 dark:bg-slate-800/60",
    border: "border-slate-200 dark:border-slate-700",
    icon: "📁",
    accent: "text-slate-600 dark:text-slate-400",
    chip: "bg-slate-100 text-slate-600 ring-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600",
    chipActive: "bg-slate-600 text-white ring-slate-600",
    dot: "bg-slate-400",
  },
};

function getPalette(majorCode) {
  return MAJOR_PALETTE[majorCode] ?? MAJOR_PALETTE.OTHER;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DocumentThumbnail({ doc }) {
  const mime = doc.cloud_files?.mime_type;
  const label = getMimeLabel(mime);
  const colorClass = getMimeColor(mime);

  if (doc.thumbnailUrl) {
    return (
      <div className="h-14 w-14 flex-none overflow-hidden rounded-xl border border-[#e5e9ef] bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-800">
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
    <span
      className={`flex h-14 w-14 flex-none items-center justify-center rounded-xl text-xs font-black ${colorClass}`}
    >
      {label}
    </span>
  );
}

function ActionButton({ children, disabled = false, onClick, tone = "default" }) {
  const tones = {
    default:
      "border-[#dbe3ed] bg-white text-[#4648d4] hover:bg-[#f8faff] dark:border-slate-600 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700",
    muted:
      "border-[#dbe3ed] bg-white text-[#344154] hover:bg-[#f8fafc] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
    share:
      "border-[#b8e8df] bg-[#f0fdf9] text-[#0f766e] hover:bg-[#e6faf4] dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900",
    danger:
      "border-[#fecaca] bg-[#fff5f5] text-[#b42318] hover:bg-[#ffecec] dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900",
  };

  return (
    <button
      className={`rounded-lg border px-3 py-1.5 text-xs font-bold cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
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
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      title={isPublic ? "Click to make private" : "Click to publish"}
      type="button"
    >
      <span className="relative h-4 w-8 rounded-full bg-white/80 ring-1 ring-black/5 dark:bg-slate-900/80">
        <span
          className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full transition-transform ${knobClass}`}
        />
      </span>
      <span>{disabled ? "Saving…" : isPublic ? "Public" : "Private"}</span>
      <span className="hidden font-bold opacity-60 transition group-hover:opacity-100 sm:inline">
        {isPublic ? "Make private" : "Publish"}
      </span>
    </button>
  );
}

// ─── Document card ──────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  user,
  updatingVisibilityId,
  onPreview,
  onDownload,
  onEdit,
  onToggleVisibility,
  onShare,
  onDelete,
  onRemoveBookmark,
  onTagClick,
  activeTags,
}) {
  const isOwner = canManageDocument(doc, user);
  const isBookmarked = isBookmarkedDocument(doc, isOwner);

  return (
    <article
      className="group cursor-pointer rounded-xl border border-[#e5e9ef] bg-white p-4 shadow-sm transition hover:border-[#c7d2fe] hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800 dark:hover:shadow-lg dark:hover:shadow-black/20"
      key={doc.id}
      onClick={() => onPreview(doc)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPreview(doc);
        }
      }}
    >
      {/* Top row: thumbnail + meta */}
      <div className="flex items-start gap-3">
        <DocumentThumbnail doc={doc} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-1">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h3 className="m-0 truncate text-sm font-bold text-[#172033] dark:text-slate-100 leading-snug">
                {doc.title}
              </h3>
              {/* Visibility badge */}
              {isOwner ? (
                <span
                  className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    doc.is_public
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-[#e8f0ff] text-[#4648d4] dark:bg-indigo-950 dark:text-indigo-300"
                  }`}
                >
                  {doc.is_public ? "Public" : "Private"}
                </span>
              ) : (
                <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {isBookmarked ? "Bookmarked" : "Shared"}
                </span>
              )}
            </div>
          </div>

          {/* Meta line */}
          <p className="m-0 mt-1 text-xs text-[#66758a] dark:text-slate-400 leading-snug">
            {doc.subjects?.code ? (
              <span className="font-semibold text-[#4648d4] dark:text-indigo-400">
                {doc.subjects.code}
              </span>
            ) : null}
            {doc.subjects?.code ? " · " : ""}
            {formatDate(doc.created_at)}
            {doc.cloud_files?.size_bytes
              ? " · " + formatFileSize(doc.cloud_files.size_bytes)
              : ""}
          </p>
        </div>
      </div>

      {/* Tags row */}
      {doc.tags?.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {doc.tags.map((tag) => {
            const isActive = activeTags.has(tag.name);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick(tag.name);
                }}
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                  isActive
                    ? "bg-[#4648d4] text-white"
                    : "bg-[#f2f4f6] text-[#66758a] hover:bg-[#e8f0ff] hover:text-[#4648d4] dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
                }`}
              >
                #{tag.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Actions row */}
      <div
        className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#f2f4f6] pt-3 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <ActionButton onClick={() => onPreview(doc)}>Preview</ActionButton>
        <ActionButton onClick={() => onDownload(doc)}>Download</ActionButton>
        {isOwner ? (
          <>
            <ActionButton onClick={() => onEdit(doc)} tone="muted">
              Edit
            </ActionButton>
            <VisibilityToggleButton
              doc={doc}
              disabled={updatingVisibilityId === doc.id}
              onClick={() => onToggleVisibility(doc)}
            />
            <ActionButton onClick={() => onShare(doc)} tone="share">
              Share
            </ActionButton>
            <ActionButton onClick={() => onDelete(doc)} tone="danger">
              Delete
            </ActionButton>
          </>
        ) : isBookmarked ? (
          <ActionButton onClick={() => onRemoveBookmark(doc)} tone="danger">
            Unbookmark
          </ActionButton>
        ) : null}
      </div>
    </article>
  );
}

// ─── Subject group section ───────────────────────────────────────────────────

function SubjectGroup({ subjectName, subjectCode, docs, paletteKey, ...cardProps }) {
  const palette = getPalette(paletteKey);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="mb-6">
      {/* Group header */}
      <button
        type="button"
        className={`w-full flex items-center gap-3 rounded-xl px-4 py-2.5 mb-3 border ${palette.bg} ${palette.border} transition hover:opacity-90 cursor-pointer`}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-lg leading-none">{palette.icon ?? "📁"}</span>
        <div className="flex-1 text-left min-w-0">
          <span className={`block text-sm font-bold ${palette.accent}`}>{subjectName}</span>
          {subjectCode ? (
            <span className="block text-[11px] font-semibold opacity-60 uppercase tracking-wide">
              {subjectCode}
            </span>
          ) : null}
        </div>
        <span className="flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${palette.chip}`}
          >
            {docs.length} doc{docs.length !== 1 ? "s" : ""}
          </span>
          <svg
            className={`h-4 w-4 transition-transform ${palette.accent} ${collapsed ? "-rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Cards grid */}
      {!collapsed && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} {...cardProps} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Major filter bar ────────────────────────────────────────────────────────

const MAJOR_LABELS = {
  CNTT: "💻 IT",
  QTKD: "📊 Business",
  TRUYENTHONG: "📡 Media",
  NGONNGU: "🌐 Languages",
  LUAT: "⚖️ Law",
};

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [majorFilter, setMajorFilter] = useState(""); // major code string
  const [visibilityFilter, setVisibilityFilter] = useState(""); // "" | "public" | "private" | "shared"
  const [activeTags, setActiveTags] = useState(new Set());

  const [subjects, setSubjects] = useState([]);
  const [editingDoc, setEditingDoc] = useState(null);
  const [sharingDoc, setSharingDoc] = useState(null);
  const [updatingVisibilityId, setUpdatingVisibilityId] = useState(null);
  const [actionError, setActionError] = useState("");

  // Only pass search + subjectId to API; rest is client-side
  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      subjectId: subjectFilter || undefined,
    }),
    [search, subjectFilter]
  );

  const { documents, setDocuments, isLoading, error, reload } = useDocuments(queryParams);
  const uploadDoc = useUploadDoc({ onUploaded: () => reload() });

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

  // Derive majors from loaded subjects
  const majorsInSubjects = useMemo(() => {
    const seen = new Map();
    subjects.forEach((s) => {
      if (s.major_id && s.major_code) {
        seen.set(s.major_code, { id: s.major_id, code: s.major_code, name: s.major_name });
      }
    });
    return [...seen.values()];
  }, [subjects]);

  // Build subject → majorCode lookup
  const subjectMajorMap = useMemo(() => {
    const m = {};
    subjects.forEach((s) => {
      m[s.id] = { code: s.major_code ?? "OTHER", name: s.major_name ?? "Other" };
    });
    return m;
  }, [subjects]);

  // Collect all unique tags from current document list
  const allTags = useMemo(() => {
    const tagMap = new Map();
    documents.forEach((doc) => {
      (doc.tags || []).forEach((t) => tagMap.set(t.name, t));
    });
    return [...tagMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [documents]);

  // Subjects grouped by major (for the subject dropdown)
  const subjectsByMajor = useMemo(() => {
    const map = {};
    subjects.forEach((s) => {
      const key = s.major_code ?? "OTHER";
      if (!map[key]) map[key] = { label: s.major_name ?? "Other", subjects: [] };
      map[key].subjects.push(s);
    });
    return map;
  }, [subjects]);

  // Client-side filtering
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      // Major filter
      if (majorFilter) {
        const subjectId = doc.subject_id;
        const majorCode = subjectId ? subjectMajorMap[subjectId]?.code : null;
        if (majorCode !== majorFilter) return false;
      }
      // Visibility filter
      if (visibilityFilter === "public" && !doc.is_public) return false;
      if (visibilityFilter === "private" && (doc.is_public || doc.user_id !== user?.id)) return false;
      if (visibilityFilter === "shared" && doc.access_via === "owner") return false;
      // Tag filter
      if (activeTags.size > 0) {
        const docTagNames = new Set((doc.tags || []).map((t) => t.name));
        for (const t of activeTags) {
          if (!docTagNames.has(t)) return false;
        }
      }
      return true;
    });
  }, [documents, majorFilter, visibilityFilter, activeTags, user, subjectMajorMap]);

  // Group filtered docs by subject → then by major
  const groupedBySubject = useMemo(() => {
    const groups = new Map(); // subjectKey → { label, code, majorCode, majorName, docs[] }

    filteredDocs.forEach((doc) => {
      const subjectId = doc.subject_id;
      const key = subjectId ? String(subjectId) : "__none__";
      if (!groups.has(key)) {
        const majorCode = subjectId ? subjectMajorMap[subjectId]?.code ?? "OTHER" : "OTHER";
        const majorName = subjectId ? subjectMajorMap[subjectId]?.name ?? "Other" : "Other";
        groups.set(key, {
          label: doc.subjects?.name ?? "No Subject",
          code: doc.subjects?.code ?? null,
          majorCode,
          majorName,
          docs: [],
        });
      }
      groups.get(key).docs.push(doc);
    });

    // Sort groups: named subjects first, then "No Subject"
    return [...groups.entries()].sort(([keyA, gA], [keyB, gB]) => {
      if (keyA === "__none__") return 1;
      if (keyB === "__none__") return -1;
      return gA.label.localeCompare(gB.label);
    });
  }, [filteredDocs, subjectMajorMap]);

  // Stats
  const ownedCount = documents.filter((doc) => canManageDocument(doc, user)).length;
  const sharedCount = documents.length - ownedCount;
  const publicCount = documents.filter((d) => d.is_public && d.user_id === user?.id).length;

  // ─── Handlers ──────────────────────────────────────────────────────────────

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
      `Move "${doc.title}" to trash? You can restore it within 30 days.`
    );
    if (!ok) return;
    setActionError("");
    try {
      await deleteDocument(doc.id);
      addToast({
        type: "success",
        title: "Moved to trash",
        message: `"${doc.title}" moved to trash.`,
      });
      setDocuments((curr) => curr.filter((d) => Number(d.id) !== Number(doc.id)));
      reload();
    } catch (err) {
      const message = err.response?.data?.error || "Could not delete.";
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
        message: `"${doc.title}" updated.`,
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

  async function handleRemoveBookmark(doc) {
    const ok = window.confirm(`Remove "${doc.title}" from My Documents?`);
    if (!ok) return;
    setActionError("");
    try {
      await removeBookmark(doc.id);
      setDocuments((curr) => curr.filter((d) => Number(d.id) !== Number(doc.id)));
      addToast({ type: "success", title: "Removed", message: `"${doc.title}" removed.` });
      reload();
    } catch (err) {
      const message = err.response?.data?.error || "Could not remove.";
      setActionError(message);
      addToast({ type: "error", title: "Failed", message });
    }
  }

  function handleTagClick(tagName) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) next.delete(tagName);
      else next.add(tagName);
      return next;
    });
  }

  function clearAllFilters() {
    setSearch("");
    setSubjectFilter("");
    setMajorFilter("");
    setVisibilityFilter("");
    setActiveTags(new Set());
  }

  const hasActiveFilters =
    search || subjectFilter || majorFilter || visibilityFilter || activeTags.size > 0;

  const cardProps = {
    user,
    updatingVisibilityId,
    onPreview: handlePreview,
    onDownload: handleDownload,
    onEdit: setEditingDoc,
    onToggleVisibility: handleToggleVisibility,
    onShare: setSharingDoc,
    onDelete: handleDelete,
    onRemoveBookmark: handleRemoveBookmark,
    onTagClick: handleTagClick,
    activeTags,
  };

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-[1280px]">
        {/* ── Page header (compact) ── */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="m-0 text-[11px] font-extrabold uppercase tracking-widest text-[#4648d4] dark:text-indigo-400">
              Documents
            </p>
            <h1 className="m-0 mt-1 text-2xl font-bold text-[#172033] dark:text-slate-100">
              My Study Library
            </h1>
          </div>

          {/* Stats pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-[#f2f4f6] px-3 py-1.5 text-xs font-bold text-[#344154] dark:bg-slate-800 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-[#4648d4]" />
              {documents.length} total
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {publicCount} public
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              {sharedCount} shared
            </span>

            <Link
              className="ml-1 inline-flex items-center gap-1.5 rounded-xl border border-[#dbe3ed] bg-white px-3 py-1.5 text-xs font-bold text-slate-600 no-underline transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              to="/documents/trash"
            >
              🗑️ Trash
            </Link>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border-0 bg-[#4648d4] px-4 py-2 text-xs font-bold text-white cursor-pointer shadow-sm transition hover:bg-[#3a3cb8]"
              onClick={uploadDoc.open}
              type="button"
            >
              <span className="text-base leading-none">+</span>
              Upload
            </button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="mb-5 rounded-2xl border border-[#e5e9ef] bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* Row 1: Search + Subject + Visibility */}
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_160px]">
            {/* Search */}
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx={11} cy={11} r={8} />
                <path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
              <input
                className="w-full rounded-xl border border-[#dbe3ed] bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 outline-none focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or tag…"
                value={search}
              />
            </div>

            {/* Subject */}
            <select
              className="rounded-xl border border-[#dbe3ed] bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4648d4] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              onChange={(e) => {
                setSubjectFilter(e.target.value);
                setMajorFilter(""); // reset major when subject selected
              }}
              value={subjectFilter}
            >
              <option value="">All subjects</option>
              {Object.entries(subjectsByMajor).map(([majorCode, { label, subjects: subs }]) => (
                <optgroup key={majorCode} label={`— ${label}`}>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* Visibility */}
            <select
              className="rounded-xl border border-[#dbe3ed] bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4648d4] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              onChange={(e) => setVisibilityFilter(e.target.value)}
              value={visibilityFilter}
            >
              <option value="">All visibility</option>
              <option value="public">Public</option>
              <option value="private">Private (mine)</option>
              <option value="shared">Shared / Bookmarked</option>
            </select>
          </div>

          {/* Row 2: Major chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
              Major:
            </span>
            <button
              type="button"
              onClick={() => setMajorFilter("")}
              className={`rounded-full px-3 py-1 text-xs font-bold ring-1 transition cursor-pointer ${
                !majorFilter
                  ? "bg-[#4648d4] text-white ring-[#4648d4]"
                  : "bg-slate-100 text-slate-600 ring-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
              }`}
            >
              All
            </button>
            {Object.entries(MAJOR_LABELS).map(([code, label]) => {
              const palette = getPalette(code);
              const isActive = majorFilter === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setMajorFilter(isActive ? "" : code);
                    setSubjectFilter(""); // reset subject when major clicked
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-bold ring-1 transition cursor-pointer ${
                    isActive ? palette.chipActive : palette.chip
                  }`}
                >
                  {label}
                </button>
              );
            })}

            {/* Clear all */}
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="ml-auto rounded-full border border-dashed border-[#fecaca] px-3 py-1 text-xs font-bold text-[#b42318] transition hover:bg-[#fff5f5] cursor-pointer dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                ✕ Clear filters
              </button>
            ) : null}
          </div>

          {/* Row 3: Active tag pills (all tags from docs) */}
          {allTags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#f2f4f6] pt-3 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                Tags:
              </span>
              {allTags.map((tag) => {
                const isActive = activeTags.has(tag.name);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleTagClick(tag.name)}
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                      isActive
                        ? "bg-[#4648d4] text-white"
                        : "bg-[#f2f4f6] text-[#66758a] hover:bg-[#e8f0ff] hover:text-[#4648d4] dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
                    }`}
                  >
                    #{tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {(error || actionError) ? (
          <div className="mb-5 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-bold text-[#b42318] dark:bg-red-950/40 dark:text-red-300">
            {error || actionError}
          </div>
        ) : null}

        {/* ── Content ── */}
        {isLoading ? (
          <div className="rounded-2xl border border-[#e5e9ef] bg-white p-12 text-center text-[#66758a] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#4648d4]/20 border-t-[#4648d4]" />
            Loading your documents…
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#c7d2fe] bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0ff] text-2xl text-[#4648d4] dark:bg-indigo-950 dark:text-indigo-300">
              {hasActiveFilters ? "🔍" : "📄"}
            </span>
            <h2 className="m-0 text-lg font-bold text-[#172033] dark:text-slate-100">
              {hasActiveFilters ? "No documents match your filters" : "No documents yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#66758a] dark:text-slate-400">
              {hasActiveFilters
                ? "Try adjusting the filters above."
                : "Upload your first PDF or DOCX to start building your study library."}
            </p>
            {hasActiveFilters ? (
              <button
                className="mt-5 rounded-xl border border-[#dbe3ed] bg-white px-5 py-2.5 text-sm font-bold text-slate-700 cursor-pointer dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                onClick={clearAllFilters}
                type="button"
              >
                Clear all filters
              </button>
            ) : (
              <button
                className="mt-5 rounded-xl border-0 bg-[#4648d4] px-5 py-3 text-sm font-bold text-white cursor-pointer"
                onClick={uploadDoc.open}
                type="button"
              >
                Upload your first document
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Result count hint */}
            <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
              Showing <strong className="text-slate-600 dark:text-slate-300">{filteredDocs.length}</strong>{" "}
              of {documents.length} document{documents.length !== 1 ? "s" : ""}
              {hasActiveFilters ? " (filtered)" : ""}
            </p>

            {/* Grouped by subject */}
            {groupedBySubject.map(([key, group]) => (
              <SubjectGroup
                key={key}
                subjectName={group.label}
                subjectCode={group.code}
                docs={group.docs}
                paletteKey={group.majorCode}
                {...cardProps}
              />
            ))}
          </>
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
