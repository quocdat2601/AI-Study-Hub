import React, { useEffect, useState, useCallback } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { searchPublicDocuments, getPublicDocument } from "../services/documentApi.js";
import { listPublicSubjects, listSubjects } from "../services/subjectApi.js";
import { addBookmark, removeBookmark, listBookmarks } from "../services/bookmarkApi.js";
import { processDocumentForAi } from "../services/aiApi.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

function FolderIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

const ALPHABET = ["All", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

export default function PublicDocumentsCatalogPage() {
  const [documents, setDocuments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  
  // Search & filter states
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") || searchParams.get("search") || "");
  const selectedSubjectId = searchParams.get("subjectId") || "";

  // Keep searchTerm in sync with URL searchParams (e.g., when navigating from hero search)
  useEffect(() => {
    const qFromParams = searchParams.get("q") || searchParams.get("search") || "";
    if (qFromParams !== searchTerm) {
      setSearchTerm(qFromParams);
    }
  }, [searchParams]);

  const handleSearchChange = (newVal) => {
    setSearchTerm(newVal);
    setPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newVal.trim()) {
        next.set("q", newVal.trim());
      } else {
        next.delete("q");
        next.delete("search");
      }
      return next;
    }, { replace: true });
  };

  const setSelectedSubjectId = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) {
        next.set("subjectId", id);
      } else {
        next.delete("subjectId");
      }
      return next;
    });
  };
  const [activeLetter, setActiveLetter] = useState("All");
  const [sortBy, setSortBy] = useState("views"); // views, downloads, newest
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [preparingAiDocId, setPreparingAiDocId] = useState(null);
  const { addToast } = useToast();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Load subjects
  useEffect(() => {
    async function loadSubjects() {
      try {
        const data = isAuthenticated ? await listSubjects() : await listPublicSubjects();
        setSubjects(data || []);
      } catch (err) {
        console.error("Failed to load subjects:", err);
      }
    }
    loadSubjects();
  }, [isAuthenticated]);

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

  // Load documents
  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await searchPublicDocuments({
        search: searchTerm,
        subjectId: selectedSubjectId || undefined,
        sortBy,
        page,
        limit: 12,
      });
      setDocuments(result.documents || []);
      setTotalPages(result.totalPages || 1);
      setTotalCount(result.totalCount || 0);
    } catch (err) {
      addToast({
        type: "error",
        title: "Error",
        message: err.response?.data?.error || "Could not fetch public documents.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedSubjectId, sortBy, page, addToast]);

  // Reset loading state and clear stale data immediately on any filter change
  useEffect(() => {
    setIsLoading(true);
    setDocuments([]);
  }, [searchTerm, selectedSubjectId, sortBy, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments();
    }, 300); // debounce search input

    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  // Handle bookmarking
  async function handleBookmarkClick(e, docId) {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }

    const isBookmarked = bookmarkedIds.has(docId);
    try {
      if (isBookmarked) {
        await removeBookmark(docId);
        setBookmarkedIds((current) => {
          const next = new Set(current);
          next.delete(docId);
          return next;
        });
        addToast({
          type: "success",
          title: "Bookmark Removed",
          message: "Document removed from your library bookmarks.",
        });
      } else {
        await addBookmark(docId);
        setBookmarkedIds((current) => {
          const next = new Set(current);
          next.add(docId);
          return next;
        });
        addToast({
          type: "success",
          title: "Bookmarked!",
          message: "Document added to your library. You can now chat with it in the AI Workspace.",
        });
      }
    } catch (err) {
      addToast({
        type: "error",
        title: "Error",
        message: err.response?.data?.error || "Could not toggle bookmark",
      });
    }
  }

  // Handle study with AI button
  async function handleStudyWithAI(e, docId) {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }

    const isBookmarked = bookmarkedIds.has(docId);
    setPreparingAiDocId(docId);
    try {
      if (!isBookmarked) {
        await addBookmark(docId);
        setBookmarkedIds((current) => new Set([...current, Number(docId)]));
      }
      await processDocumentForAi(docId, { force: false });
      navigate(`/workspace/documents/${docId}`);
    } catch (err) {
      addToast({
        type: "error",
        title: "Could not prepare AI chat",
        message: err.response?.data?.error || "This document is still processing or has no readable text yet. Please try again shortly.",
      });
    } finally {
      setPreparingAiDocId(null);
    }
  }

  const activeSubject = subjects.find(s => Number(s.id) === Number(selectedSubjectId));
  const isBrowsingSubjects = !selectedSubjectId && !searchTerm.trim();

  // Filter subjects based on first letter
  const filteredSubjects = subjects.filter((sub) => {
    if (activeLetter === "All") return true;
    return sub.name.trim().toUpperCase().startsWith(activeLetter.toUpperCase());
  });

  const pageContent = (
      <section className="flex flex-col gap-6">
        {/* Render global hero banner ONLY if NOT browsing a subject folder */}
        {!selectedSubjectId && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 px-6 py-10 text-white shadow-md md:px-10 md:py-14">
            <div className="absolute right-0 bottom-0 top-0 hidden w-1/3 opacity-15 lg:block">
              <svg className="h-full w-full" fill="currentColor" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M0,100 C30,40 70,60 100,0 L100,100 Z" />
              </svg>
            </div>
            <div className="relative max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-250">Explore Hub</span>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Find Study Documents</h1>
              <p className="mt-2 text-sm text-indigo-100">
                Browse public summaries, lecture notes, essays, and study packages shared by other students.
              </p>
              <div className="mt-6 flex max-w-lg items-center rounded-xl bg-white p-1 text-slate-800 shadow-lg">
                <span className="pl-3 text-slate-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  className="flex-1 min-w-0 border-0 bg-transparent px-3 h-10 py-0 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  type="text"
                  placeholder="Search by title, subject or tag..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Combined Subject Folder Header Block (Studocu-style) */}
        {selectedSubjectId && activeSubject && (
          <div className="flex flex-col gap-4 rounded-2xl bg-emerald-50/50 p-6 dark:bg-emerald-950/10 border border-emerald-150/40 dark:border-emerald-900/30 shadow-sm">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubjectId("");
                  handleSearchChange("");
                }}
                className="cursor-pointer bg-transparent border-0 p-0 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
              >
                Explore Docs
              </button>
              <span>&gt;</span>
              <span className="text-slate-800 dark:text-slate-200">{activeSubject.name}</span>
            </div>

            {/* Folder Info Block */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
                <FolderIcon className="h-8 w-8 fill-emerald-400" />
              </div>
              <div className="min-w-0">
                <h1 className="m-0 text-2xl font-black text-slate-900 dark:text-slate-100">
                  {activeSubject.name} ({activeSubject.code})
                </h1>
                {/* Stats list under title */}
                <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {totalCount} documents
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.232.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    FPT Course
                  </span>
                </div>
              </div>
            </div>

            {/* Buttons and Search bar line */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/50 pt-4 dark:border-slate-800/40">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`cursor-pointer rounded-lg border px-4 py-2 text-xs font-black transition-all ${
                    isFollowing
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-750 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {isFollowing ? "✓ Following" : "+ Follow"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    addToast({ type: "success", title: "Copied", message: "Folder link copied to clipboard." });
                  }}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-750 dark:bg-slate-800 dark:text-slate-300"
                >
                  Share
                </button>
              </div>

              {/* Internal Subject Search Bar */}
              <div className="flex w-full max-w-xs items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 dark:border-slate-750 dark:bg-slate-850">
                <span className="text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder={`Find in ${activeSubject.code}...`}
                  className="flex-1 min-w-0 border-0 bg-transparent px-2 h-7 py-0 text-xs outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {isBrowsingSubjects ? (
          /* SECTION A: Subjects/Courses directory */
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="m-0 text-xl font-black text-slate-800 dark:text-slate-100">Courses & Subjects</h2>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {subjects.length} subjects registered
              </div>
            </div>

            {/* Alphabet filter */}
            <div className="flex flex-wrap items-center gap-1 overflow-x-auto pb-2 border-b border-slate-200/60 dark:border-slate-800">
              {ALPHABET.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => setActiveLetter(letter)}
                  className={`cursor-pointer rounded px-2.5 py-1 text-xs font-bold transition ${
                    activeLetter === letter
                      ? "bg-indigo-650 text-white shadow-sm"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-850 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
              {/* Folder list */}
              <div className="flex flex-col gap-4">
                {filteredSubjects.length === 0 ? (
                  <p className="my-10 text-center text-sm italic text-slate-400">
                    No subjects found starting with "{activeLetter}"
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {filteredSubjects.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubjectId(sub.id);
                          setPage(1);
                        }}
                        className="flex cursor-pointer items-start gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:scale-[1.01] hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-900"
                      >
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-650 dark:bg-teal-950/40 dark:text-teal-400">
                          <FolderIcon className="h-5.5 w-5.5 fill-teal-50 dark:fill-transparent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <strong className="block truncate text-sm font-black text-slate-850 dark:text-slate-100">
                            {sub.name}
                          </strong>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-550 dark:bg-slate-800 dark:text-slate-400">
                              {sub.code}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-550">
                              • {sub.docCount || 0} {sub.docCount === 1 ? 'doc' : 'docs'}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="m-0 text-sm font-black text-slate-900 dark:text-slate-100">
                  Resource Pool
                </h3>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-500">Shared Documents</span>
                    <span className="font-black text-slate-850 dark:text-slate-200">{totalCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-500">Academic Subjects</span>
                    <span className="font-black text-slate-850 dark:text-slate-200">{subjects.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1.5">
                    <span className="font-bold text-slate-500">Format Supported</span>
                    <span className="font-black text-slate-850 dark:text-slate-200">PDF & Text</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* SECTION B: Document List (Subject active or search term typed) */
          <div className="flex flex-col gap-6">

            {/* If NOT in a subject folder but searching globally, show back to subjects link */}
            {!selectedSubjectId && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId("");
                    handleSearchChange("");
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 bg-transparent border-0 text-sm font-bold text-slate-500 transition hover:text-indigo-650 dark:text-slate-400 dark:hover:text-indigo-400"
                >
                  ← Back to Subjects
                </button>
              </div>
            )}

            {/* Filters and sorting */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="rounded-lg border border-slate-350 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Subjects</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>

                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                  {["views", "downloads", "newest"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setSortBy(mode);
                        setPage(1);
                      }}
                      className={`cursor-pointer rounded-md border-0 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                        sortBy === mode
                          ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                          : "bg-transparent text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
                      }`}
                    >
                      {mode === "views" ? "Popular" : mode}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {isLoading ? "Loading documents..." : `Showing ${documents.length} of ${totalCount} resources`}
              </div>
            </div>

            {/* Documents Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex h-64 animate-pulse flex-col rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-850" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-slate-300 dark:text-slate-650">
                  <svg className="h-16 w-16 stroke-current" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-200">No documents found</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Try adjusting your search criteria or choosing a different subject.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {documents.map((doc) => {
                  const isBookmarked = bookmarkedIds.has(doc.id);
                  return (
                    <Link
                      key={doc.id}
                      to={`/public-documents/${doc.id}${selectedSubjectId ? `?backSubjectId=${selectedSubjectId}` : ""}`}
                      onMouseEnter={() => {
                        getPublicDocument(doc.id).catch(() => {});
                      }}
                      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-900"
                    >
                      {/* Thumbnail / Header */}
                      <div className="relative flex h-36 items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
                        {doc.thumbnailUrl ? (
                          <img
                            className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                            src={doc.thumbnailUrl}
                            alt={doc.title}
                          />
                        ) : (
                          <span className="text-slate-350 dark:text-slate-700">
                            <svg className="h-14 w-14 stroke-current" fill="none" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </span>
                        )}

                        {/* Badge */}
                        <span className="absolute top-2.5 left-2.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                          {doc.fileType || "PDF"}
                        </span>

                        {/* Bookmark action */}
                        <button
                          type="button"
                          onClick={(e) => handleBookmarkClick(e, doc.id)}
                          className={`absolute top-2 right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:scale-105 ${
                            isBookmarked ? "text-amber-500" : "text-slate-400 hover:text-slate-600"
                          } dark:border-slate-700 dark:bg-slate-800`}
                          aria-label={isBookmarked ? "Remove from Library" : "Bookmark document"}
                        >
                          <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
                            <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                          </svg>
                        </button>
                      </div>

                      {/* Body Info */}
                      <div className="flex flex-1 flex-col p-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-650 dark:text-teal-400">
                          {doc.subjectCode || "Generic"}
                        </span>
                        <h3 className="mt-1 line-clamp-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                          {doc.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 flex-1 text-xs text-slate-500 leading-relaxed dark:text-slate-400">
                          {doc.previewText || "No document summary preview available."}
                        </p>

                        {/* Card Footer */}
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              {doc.viewCount || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              {doc.downloadCount || 0}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleStudyWithAI(e, doc.id)}
                            disabled={preparingAiDocId === doc.id}
                            className="cursor-pointer rounded bg-indigo-650 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-indigo-750 disabled:cursor-wait disabled:opacity-70"
                          >
                            {preparingAiDocId === doc.id ? "Preparing..." : "Study with AI"}
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  type="button"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-350 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {"<"}
                </button>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  type="button"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-350 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {">"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
  );

  return (
    <main className="min-h-[calc(100vh-65px)] bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto w-full max-w-6xl">
        {pageContent}
      </div>
    </main>
  );
}
