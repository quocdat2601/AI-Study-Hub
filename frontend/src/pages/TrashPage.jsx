import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { formatFileSize } from "../lib/formatFileSize.js";
import {
  listTrash,
  restoreDocument,
  purgeDocument,
  emptyTrash,
  bulkRestoreDocuments,
} from "../services/documentApi.js";

const RETENTION_DAYS = 30;

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

function daysLeft(deletedAt) {
  if (!deletedAt) return RETENTION_DAYS;
  const elapsedDays = (Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(RETENTION_DAYS - elapsedDays));
}

function ActionButton({ children, disabled = false, onClick, tone = "default" }) {
  const tones = {
    default: "border-[#dbe3ed] bg-white text-[#4648d4] hover:bg-[#f8faff] dark:border-slate-600 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700",
    danger: "border-[#fecaca] bg-[#fff5f5] text-[#b42318] hover:bg-[#ffecec] dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900",
  };
  return (
    <button
      className={`rounded-lg border px-3 py-1.5 text-xs font-bold cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export default function TrashPage() {
  const { addToast } = useToast();

  const [docs, setDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await listTrash();
      setDocs(Array.isArray(data) ? data : []);
      setSelected(new Set());
      setIsSelectMode(false);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load trash.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === docs.length ? new Set() : new Set(docs.map((doc) => doc.id))));
  }

  function exitSelectMode() {
    setSelected(new Set());
    setIsSelectMode(false);
  }

  async function handleRestore(doc) {
    setBusy(true);
    try {
      await restoreDocument(doc.id);
      addToast({ type: "success", title: "Restored", message: `"${doc.title}" was restored.` });
      load();
    } catch (err) {
      addToast({ type: "error", title: "Restore failed", message: err.response?.data?.error || "Could not restore." });
    } finally {
      setBusy(false);
    }
  }

  async function handlePurge(doc) {
    const ok = window.confirm(
      `Permanently delete "${doc.title}"? This cannot be undone — the file will be removed from storage.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      await purgeDocument(doc.id);
      addToast({ type: "success", title: "Permanently deleted", message: `"${doc.title}" was removed forever.` });
      load();
    } catch (err) {
      addToast({ type: "error", title: "Delete failed", message: err.response?.data?.error || "Could not delete." });
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkRestore() {
    if (!selected.size) return;
    setBusy(true);
    try {
      const result = await bulkRestoreDocuments([...selected]);
      addToast({ type: "success", title: "Restored", message: result.message });
      load();
    } catch (err) {
      addToast({ type: "error", title: "Restore failed", message: err.response?.data?.error || "Could not restore." });
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkPurge() {
    if (!selected.size) return;
    const ok = window.confirm(
      `Permanently delete ${selected.size} document(s)? This cannot be undone — the files will be removed from storage.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const results = await Promise.allSettled([...selected].map((id) => purgeDocument(id)));
      const failed = results.filter((item) => item.status === "rejected").length;
      const purged = results.length - failed;
      addToast({
        type: failed ? "error" : "success",
        title: failed ? "Partially deleted" : "Permanently deleted",
        message: failed
          ? `${purged} document(s) removed, ${failed} failed.`
          : `${purged} document(s) were removed forever.`,
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleEmptyTrash() {
    if (!docs.length) return;
    const ok = window.confirm(
      `Empty trash? All ${docs.length} document(s) will be permanently deleted. This cannot be undone.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const result = await emptyTrash();
      addToast({ type: "success", title: "Trash emptied", message: result.message });
      load();
    } catch (err) {
      addToast({ type: "error", title: "Failed", message: err.response?.data?.error || "Could not empty trash." });
    } finally {
      setBusy(false);
    }
  }

  const allSelected = docs.length > 0 && selected.size === docs.length;

  return (
    <DashboardShell>
      <div className={`mx-auto w-full max-w-[1280px] ${isSelectMode ? "pb-24" : ""}`}>
        <section className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#64748b] to-[#475569] p-6 text-white shadow-[0_12px_30px_rgba(71,85,105,0.25)] md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-widest text-white/75">Documents</p>
              <h1 className="m-0 mt-2 text-3xl font-bold">🗑️ Trash</h1>
              <p className="m-0 mt-2 max-w-2xl text-sm text-white/90">
                Deleted documents stay here for {RETENTION_DAYS} days, then are permanently removed automatically.
                You can restore them or delete them forever now.
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#475569] shadow-[0_8px_20px_rgba(15,23,42,0.15)]"
              to="/documents"
            >
              ← Back to Documents
            </Link>
          </div>
        </section>

        {docs.length ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton
                disabled={busy}
                onClick={isSelectMode ? exitSelectMode : () => setIsSelectMode(true)}
              >
                {isSelectMode ? "Cancel" : "Select"}
              </ActionButton>
              <p className="m-0 text-sm text-[#66758a] dark:text-slate-400">
                {docs.length} document{docs.length === 1 ? "" : "s"} in trash
              </p>
            </div>
            <ActionButton disabled={busy} onClick={handleEmptyTrash} tone="danger">
              Empty trash
            </ActionButton>
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-bold text-[#b42318] dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-[#e5e9ef] bg-white p-10 text-center text-[#66758a] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Loading trash...
          </div>
        ) : docs.length ? (
          <div className="grid gap-4">
            {docs.map((doc) => {
              const left = daysLeft(doc.deleted_at);
              const isSelected = selected.has(doc.id);
              return (
                <article
                  className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md dark:bg-slate-900 dark:hover:shadow-lg dark:hover:shadow-black/20 ${
                    isSelected
                      ? "border-[#4648d4] ring-1 ring-[#4648d4]/30 dark:border-indigo-500 dark:ring-indigo-500/30"
                      : "border-[#e5e9ef] dark:border-slate-800"
                  }`}
                  key={doc.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      {isSelectMode ? (
                        <input
                          aria-label={`Select ${doc.title}`}
                          checked={isSelected}
                          className="mt-1 h-4 w-4 flex-none cursor-pointer accent-[#4648d4]"
                          onChange={() => toggleSelect(doc.id)}
                          type="checkbox"
                        />
                      ) : null}
                      <span className="flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-[#f2f4f6] text-xs font-black text-[#66758a] dark:bg-slate-800 dark:text-slate-400">
                        {getMimeLabel(doc.cloud_files?.mime_type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="m-0 truncate text-base font-bold text-[#172033] dark:text-slate-100">
                          {doc.title}
                        </h2>
                        <p className="m-0 mt-1 text-sm text-[#66758a] dark:text-slate-400">
                          {doc.subjects?.name || "No subject"} · deleted {formatDate(doc.deleted_at)} ·{" "}
                          {formatFileSize(doc.cloud_files?.size_bytes)}
                        </p>
                        <span
                          className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            left <= 3
                              ? "bg-[#fee2e2] text-[#b42318] dark:bg-red-950 dark:text-red-300"
                              : "bg-[#fef3c7] text-[#92400e] dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {left} day{left === 1 ? "" : "s"} left before auto-delete
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ActionButton disabled={busy} onClick={() => handleRestore(doc)}>
                        Restore
                      </ActionButton>
                      <ActionButton disabled={busy} onClick={() => handlePurge(doc)} tone="danger">
                        Delete permanently
                      </ActionButton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#c7d2fe] bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef0ff] text-2xl text-[#4648d4] dark:bg-indigo-950 dark:text-indigo-300">
              🗑️
            </span>
            <h2 className="m-0 text-lg font-bold text-[#172033] dark:text-slate-100">Trash is empty</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#66758a] dark:text-slate-400">
              Documents you delete will appear here and can be restored within {RETENTION_DAYS} days.
            </p>
            <Link
              className="mt-5 inline-block rounded-xl bg-[#4648d4] px-5 py-3 text-sm font-bold text-white"
              to="/documents"
            >
              Back to Documents
            </Link>
          </div>
        )}

        {isSelectMode && docs.length ? (
          <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-6">
            <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e5e9ef] bg-white px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900">
              <span className="text-sm font-bold text-[#172033] dark:text-slate-100">
                {selected.size} selected
              </span>
              <button
                className="text-xs font-bold text-[#4648d4] underline-offset-2 hover:underline cursor-pointer dark:text-indigo-300"
                onClick={toggleSelectAll}
                type="button"
              >
                {allSelected ? "Clear all" : `Select all (${docs.length})`}
              </button>
              <span className="h-5 w-px bg-[#e5e9ef] dark:bg-slate-700" />
              <div className="flex flex-wrap gap-2">
                <ActionButton disabled={busy || !selected.size} onClick={handleBulkRestore}>
                  Restore
                </ActionButton>
                <ActionButton disabled={busy || !selected.size} onClick={handleBulkPurge} tone="danger">
                  Delete permanently
                </ActionButton>
                <ActionButton disabled={busy} onClick={exitSelectMode}>
                  Cancel
                </ActionButton>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
