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
    <main className="page">
      <section className="section-header">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Document Library</h1>
          <p className="muted">Documents with readable extracted text can be attached to AI chat sessions.</p>
        </div>
        <Link className="button button--primary" to="/chat">
          Open AI Chat
        </Link>
      </section>

      {error ? <div className="alert alert--error">{error}</div> : null}

      {isLoading || bookmarksLoading ? (
        <p className="muted">Loading documents...</p>
      ) : documents.length ? (
        <div className="document-list">
          {documents.map((doc) => (
            <article className="document-card" key={doc.id}>
              <div>
                <h2>{doc.title}</h2>
                <p className="muted">
                  {doc.subjects?.code || "No subject"} - {doc.cloud_files?.mime_type || "Unknown type"}
                </p>
              </div>
              <div className="document-card__actions">
                <span className={`status status--${doc.extraction_status || "pending"}`}>
                  {getStatusLabel(doc.extraction_status)}
                </span>
                <button
                  className={bookmarkedDocIds.has(doc.id) ? "button button--secondary" : "button button--ghost"}
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
        <p className="muted">No documents found.</p>
      )}
    </main>
  );
}
