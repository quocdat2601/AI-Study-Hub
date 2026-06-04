import React from "react";
import { Link } from "react-router-dom";
import useBookmarks from "../hooks/useBookmarks.js";
import useDocuments from "../hooks/useDocuments.js";

function getStatusLabel(status) {
  if (status === "ready") return "Ready for chat";
  if (status === "empty") return "No readable text";
  if (status === "failed") return "Extraction failed";
  return "Processing";
}

const STATUS_CLASSES = {
  ready: "bg-[#e8f5ee] text-[#087443]",
  empty: "bg-[#fff0f0] text-[#b42318]",
  failed: "bg-[#fff0f0] text-[#b42318]",
  pending: "bg-[#fff7e6] text-[#975a16]",
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
    <main className="mx-auto max-w-[1120px] px-6 my-8 bg-white border border-[#e5e9ef] rounded-lg p-8">
      <section className="flex items-center justify-between mb-[22px]">
        <div>
          <p className="text-[#0f766e] text-[13px] font-extrabold uppercase m-0">Library</p>
          <h1 className="mt-2 mb-2.5">Document Library</h1>
          <p className="text-[#66758a] m-0">Documents with readable extracted text can be attached to AI chat sessions.</p>
        </div>
        <Link className="inline-flex items-center justify-center rounded-lg cursor-pointer font-extrabold min-h-11 px-[18px] bg-[#0f766e] text-white no-underline" to="/chat">
          Open AI Chat
        </Link>
      </section>

      {error ? <div className="rounded-lg font-bold my-4 px-[14px] py-3 bg-[#fff0f0] text-[#b42318]">{error}</div> : null}

      {isLoading || bookmarksLoading ? (
        <p className="text-[#66758a]">Loading documents...</p>
      ) : documents.length ? (
        <div className="grid gap-[14px]">
          {documents.map((doc) => (
            <article className="flex items-center justify-between gap-[18px] border border-[#e5e9ef] rounded-lg p-4" key={doc.id}>
              <div>
                <h2 className="text-lg m-0 mb-1.5">{doc.title}</h2>
                <p className="text-[#66758a] m-0 text-sm">
                  {doc.subjects?.code || "No subject"} - {doc.cloud_files?.mime_type || "Unknown type"}
                </p>
              </div>
              <div className="flex items-center flex-wrap gap-[10px] justify-end">
                <span className={`inline-flex rounded-full text-xs font-extrabold px-[10px] py-[5px] ${STATUS_CLASSES[doc.extraction_status || "pending"] ?? ""}`}>
                  {getStatusLabel(doc.extraction_status)}
                </span>
                <button
                  className={`inline-flex items-center justify-center rounded-lg cursor-pointer font-extrabold min-h-11 px-[18px] border ${bookmarkedDocIds.has(doc.id) ? "bg-white border-[#cbd5e1] text-[#172033]" : "bg-[#f8fafc] border-[#dbe3ed] text-[#42526a]"}`}
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
        <p className="text-[#66758a]">No documents found.</p>
      )}
    </main>
  );
}
