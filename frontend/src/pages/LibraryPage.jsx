import React from "react";
import { Link } from "react-router-dom";
import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import useBookmarks from "../hooks/useBookmarks.js";
import useDocuments from "../hooks/useDocuments.js";

function getStatusLabel(status) {
  if (status === "ready") return "Ready for chat";
  if (status === "empty") return "No readable text";
  if (status === "failed") return "Extraction failed";
  return "Processing";
}

const STATUS_CLASSES = {
  ready: "bg-[#e8f5ee] text-[#087443] dark:bg-emerald-950 dark:text-emerald-300",
  empty: "bg-[#fff0f0] text-[#b42318] dark:bg-red-950 dark:text-red-300",
  failed: "bg-[#fff0f0] text-[#b42318] dark:bg-red-950 dark:text-red-300",
  pending: "bg-[#fff7e6] text-[#975a16] dark:bg-amber-950 dark:text-amber-300",
};

export default function LibraryPage() {
  const {
    documents,
    isLoading,
    error: documentError,
  } = useDocuments();
  const {
    bookmarkedDocIds,
    isLoading: bookmarksLoading,
    error: bookmarkError,
    setError: setBookmarkError,
    toggleBookmark,
  } = useBookmarks();

  async function handleToggleBookmark(docId) {
    setBookmarkError("");
    try {
      await toggleBookmark(docId);
    } catch (err) {
      setBookmarkError(err.response?.data?.error || "Could not update bookmark");
    }
  }

  const error = documentError || bookmarkError;

  return (
    <DashboardShell>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="m-0 text-[13px] font-extrabold uppercase text-teal-700 dark:text-teal-300">Library</p>
            <h1 className="m-0 mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Document Library</h1>
            <p className="m-0 mt-2 text-sm text-slate-500 dark:text-slate-400">
              Documents with readable extracted text can be attached to AI chat sessions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-[18px] font-extrabold text-white no-underline" to="/documents">
              Document Management
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-[18px] font-extrabold text-indigo-600 no-underline dark:border-slate-600 dark:bg-slate-800 dark:text-indigo-300" to="/documents?upload=true">
              Upload Documents
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg bg-red-50 px-[14px] py-3 font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>
        ) : null}

        {isLoading || bookmarksLoading ? (
          <p className="text-slate-500 dark:text-slate-400">Loading documents...</p>
        ) : documents.length ? (
          <div className="grid gap-[14px]">
            {documents.map((doc) => (
              <article className="flex flex-wrap items-center justify-between gap-[18px] rounded-lg border border-slate-200 p-4 dark:border-slate-700" key={doc.id}>
                <div>
                  <h2 className="m-0 mb-1.5 text-lg text-slate-900 dark:text-slate-100">{doc.title}</h2>
                  <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
                    {doc.subjects?.code || "No subject"} - {doc.cloud_files?.mime_type || "Unknown type"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-[10px]">
                  <span className={`inline-flex rounded-full px-[10px] py-[5px] text-xs font-extrabold ${STATUS_CLASSES[doc.extraction_status || "pending"] ?? ""}`}>
                    {getStatusLabel(doc.extraction_status)}
                  </span>
                  <button
                    className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-[18px] font-extrabold ${bookmarkedDocIds.has(doc.id) ? "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"}`}
                    onClick={() => handleToggleBookmark(doc.id)}
                    type="button"
                  >
                    {bookmarkedDocIds.has(doc.id) ? "Bookmarked" : "Bookmark"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400">No documents found.</p>
        )}
      </section>
    </DashboardShell>
  );
}
