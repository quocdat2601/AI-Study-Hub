import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import {
  getPublicDocument,
  getPublicDocumentSignedUrl,
  listDocumentComments,
  addDocumentComment
} from "../services/documentApi.js";
import { addBookmark, removeBookmark, listBookmarks } from "../services/bookmarkApi.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

export default function PublicDocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const { isAuthenticated } = useAuth();

  const [doc, setDoc] = useState(null);
  const [comments, setComments] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [signedUrl, setSignedUrl] = useState("");

  // Loading & Action states
  const [isLoading, setIsLoading] = useState(true);
  const [isCommentsLoading, setIsCommentsLoading] = useState(true);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);

  // Form states
  const [newComment, setNewComment] = useState("");
  const [newRating, setNewRating] = useState(5);

  const [viewMode, setViewMode] = useState("pdf"); // pdf, text

  // Load document metadata and signed url
  useEffect(() => {
    async function loadDocData() {
      setIsLoading(true);
      try {
        const docData = await getPublicDocument(id);
        setDoc(docData);

        // Fetch signed url for preview
        const urlData = await getPublicDocumentSignedUrl(id);
        setSignedUrl(urlData.signedUrl);
      } catch (err) {
        addToast({
          type: "error",
          title: "Error",
          message: err.response?.data?.error || "Could not retrieve public document."
        });
        navigate("/public-documents");
      } finally {
        setIsLoading(false);
      }
    }
    loadDocData();
  }, [id, navigate, addToast]);

  // Load comments
  const loadComments = useCallback(async () => {
    setIsCommentsLoading(true);
    try {
      const commentsData = await listDocumentComments(id);
      setComments(commentsData || []);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setIsCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Load bookmarks
  const loadBookmarks = useCallback(async () => {
    if (!isAuthenticated) {
      setBookmarkedIds(new Set());
      return;
    }

    try {
      const data = await listBookmarks();
      setBookmarkedIds(new Set((data || []).map((b) => b.doc_id)));
    } catch (err) {
      console.error("Failed to load bookmarks:", err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  // Format bytes
  function formatBytes(bytes) {
    if (bytes === 0 || !bytes || isNaN(bytes)) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  // Calculate average rating
  const ratedComments = comments.filter((c) => c.rating);
  const avgRating = ratedComments.length
    ? (ratedComments.reduce((sum, c) => sum + (c.rating || 0), 0) / ratedComments.length).toFixed(1)
    : null;

  const isBookmarked = bookmarkedIds.has(Number(id));

  // Toggle bookmark
  async function handleBookmarkToggle() {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }

    setIsBookmarking(true);
    try {
      if (isBookmarked) {
        await removeBookmark(id);
        setBookmarkedIds((current) => {
          const next = new Set(current);
          next.delete(Number(id));
          return next;
        });
        addToast({
          type: "success",
          title: "Bookmark Removed",
          message: "Document removed from your bookmarks library."
        });
      } else {
        await addBookmark(id);
        setBookmarkedIds((current) => {
          const next = new Set(current);
          next.add(Number(id));
          return next;
        });
        addToast({
          type: "success",
          title: "Bookmarked!",
          message: "Added to library. Access this document anytime in the AI Workspace."
        });
      }
    } catch (err) {
      addToast({
        type: "error",
        title: "Error",
        message: err.response?.data?.error || "Could not toggle bookmark."
      });
    } finally {
      setIsBookmarking(false);
    }
  }

  // Study with AI
  async function handleStudyWithAI() {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }

    try {
      if (!isBookmarked) {
        await addBookmark(id);
      }
      navigate(`/workspace?docId=${id}`);
    } catch (_err) {
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to open document in AI Workspace."
      });
    }
  }

  // Download PDF
  async function handleDownload() {
    setIsDownloading(true);
    try {
      const { signedUrl: downloadUrl } = await getPublicDocumentSignedUrl(id);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = doc?.title || "study-resource.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Increment downloads count in local view
      setDoc((current) => ({
        ...current,
        downloadCount: (current.downloadCount || 0) + 1
      }));

      addToast({
        type: "success",
        title: "Success",
        message: "File download has been initiated."
      });
    } catch (_err) {
      addToast({
        type: "error",
        title: "Download Failed",
        message: "Could not download the file."
      });
    } finally {
      setIsDownloading(false);
    }
  }

  // Submit comment
  async function handleAddReview(e) {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }

    setIsSubmittingReview(true);
    try {
      const added = await addDocumentComment(id, newComment, newRating);
      setComments((current) => [added, ...current]);
      setNewComment("");
      setNewRating(5);
      addToast({
        type: "success",
        title: "Review Submitted",
        message: "Thank you for sharing your feedback!"
      });
    } catch (err) {
      addToast({
        type: "error",
        title: "Error",
        message: err.response?.data?.error || "Failed to submit review."
      });
    } finally {
      setIsSubmittingReview(false);
    }
  }

  // Render Stars
  function renderStars(rating, size = "h-4 w-4") {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <svg
            key={idx}
            className={`${size} ${idx < rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  }

  function renderPage(content) {
    return (
      <main className="min-h-[calc(100vh-65px)] bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          {content}
        </div>
      </main>
    );
  }

  if (isLoading || !doc) {
    return renderPage(
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-650" />
          <p className="text-sm font-semibold text-slate-500">Loading document workspace...</p>
        </div>
    );
  }

  const documentType = doc.cloud_files?.mime_type || "";
  const isPdf = documentType.includes("pdf") || doc.title.toLowerCase().endsWith(".pdf");

  return renderPage(
      <section className="flex flex-col gap-6">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            to="/public-documents"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 no-underline transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          >
            ← Back to Catalog
          </Link>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => setViewMode("pdf")}
              disabled={!isPdf}
              className={`cursor-pointer rounded-md border-0 px-3 py-1.5 text-xs font-semibold transition ${viewMode === "pdf"
                  ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                  : "bg-transparent text-slate-500 hover:text-slate-800 disabled:opacity-40"
                }`}
            >
              PDF Viewer
            </button>
            <button
              onClick={() => setViewMode("text")}
              className={`cursor-pointer rounded-md border-0 px-3 py-1.5 text-xs font-semibold transition ${viewMode === "text"
                  ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                  : "bg-transparent text-slate-500 hover:text-slate-800"
                }`}
            >
              Text Summary
            </button>
          </div>
        </div>

        {/* Main Workspace Layout */}
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          {/* Document Content View Pane */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
            <h1 className="m-0 text-xl font-black text-slate-900 dark:text-slate-100">{doc.title}</h1>
            <p className="mt-1 mb-6 text-xs font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              {doc.subjects?.code || "Generic"} - {doc.subjects?.name || "Shared Study Material"}
            </p>

            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
              {viewMode === "pdf" && isPdf && signedUrl ? (
                <iframe
                  title="Document Preview"
                  className="h-full w-full border-0"
                  src={`${signedUrl}#toolbar=0&navpanes=0`}
                />
              ) : (
                <div className="h-full overflow-y-auto p-6 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  <h3 className="m-0 mb-4 text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Extracted Document Content
                  </h3>
                  {doc.extracted_text ? (
                    <p className="whitespace-pre-line">{doc.extracted_text}</p>
                  ) : (
                    <p className="italic text-slate-400">No raw text summary was indexed for this document.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action and Info Sidebar */}
          <div className="flex flex-col gap-6">
            {/* Study Panel */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="m-0 text-lg font-black text-slate-900 dark:text-slate-100">Study with AI</h2>
              <p className="mt-1 mb-6 text-xs leading-relaxed text-slate-500 dark:text-slate-450">
                Instantly connect this public resource to your personal workspace to outline highlights, generate study quizzes, or chat with AI.
              </p>

              <div className="grid gap-3">
                <button
                  onClick={handleStudyWithAI}
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-[18px] font-black text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Chat with Document
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleBookmarkToggle}
                    disabled={isBookmarking}
                    className={`flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition ${isBookmarked
                        ? "border-amber-250 bg-amber-50/40 text-amber-600 dark:border-amber-800 dark:bg-amber-950/20"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-750 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                  >
                    <svg className={`h-4 w-4 ${isBookmarked ? "fill-amber-500 text-amber-500" : "fill-none"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    {isBookmarked ? "Bookmarked" : "Add to Library"}
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-750 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Document stats */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="m-0 text-sm font-black text-slate-900 dark:text-slate-100">Overview</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-850">
                  <small className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Views</small>
                  <strong className="mt-0.5 block text-lg font-black text-slate-800 dark:text-slate-200">{doc.viewCount || 0}</strong>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-850">
                  <small className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Downloads</small>
                  <strong className="mt-0.5 block text-lg font-black text-slate-800 dark:text-slate-200">{doc.downloadCount || 0}</strong>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
                <div className="flex justify-between py-1.5">
                  <span className="font-bold text-slate-500">File Size</span>
                  <span className="font-black text-slate-800 dark:text-slate-200">{formatBytes(doc.cloud_files?.size_bytes)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-bold text-slate-500">Subject Code</span>
                  <span className="font-black text-indigo-650 dark:text-indigo-400">{doc.subjects?.code || "GENERIC"}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-bold text-slate-500">Uploaded By</span>
                  <span className="font-black text-slate-800 dark:text-slate-200">{doc.uploader?.email?.split("@")[0] || "Student"}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-bold text-slate-500">Date Shared</span>
                  <span className="font-black text-slate-800 dark:text-slate-200">{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Ratings & reviews */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="m-0 text-sm font-black text-slate-900 dark:text-slate-100">Student Reviews</h3>
                {avgRating && (
                  <div className="flex items-center gap-1">
                    {renderStars(Math.round(Number(avgRating)), "h-3.5 w-3.5")}
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{avgRating}</span>
                  </div>
                )}
              </div>

              {/* Add review form */}
              <form className="mt-4 border-b border-slate-100 pb-5 dark:border-slate-800" onSubmit={handleAddReview}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500">Your Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className="cursor-pointer bg-transparent border-0 outline-none p-0.5 transition hover:scale-110"
                      >
                        <svg
                          className={`h-5 w-5 ${star <= newRating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"
                            }`}
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-2.5 flex flex-col gap-2">
                  <textarea
                    required
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-750 dark:bg-slate-850 dark:text-slate-200"
                    placeholder="Write your study notes review or feedback here..."
                    rows="3"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="self-end cursor-pointer rounded-lg border-0 bg-indigo-650 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSubmittingReview ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </form>

              {/* Reviews list */}
              <div className="mt-5 flex flex-col gap-4">
                {isCommentsLoading ? (
                  <p className="text-center text-xs text-slate-400">Loading reviews...</p>
                ) : comments.length === 0 ? (
                  <p className="my-2 text-center text-xs italic text-slate-400">No reviews shared yet. Be the first!</p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto pr-1 flex flex-col gap-4">
                    {comments.map((comment) => (
                      <article key={comment.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-850/40">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-650 dark:text-slate-350">
                            {comment.user?.email?.split("@")[0]}
                          </span>
                          <span className="text-slate-400">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {comment.rating && <div className="mt-1">{renderStars(comment.rating, "h-3 w-3")}</div>}
                        <p className="mt-2 mb-0 text-xs text-slate-650 leading-relaxed dark:text-slate-300">
                          {comment.content}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
