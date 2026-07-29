import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { searchPublicDocuments } from "../../services/documentApi.js";
import { listPublicSubjects, listSubjects } from "../../services/subjectApi.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

function FolderIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function DocIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

export default function HeroSearch() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState({ subjects: [], documents: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const allSubjectsRef = useRef([]);

  useEffect(() => {
    let isMounted = true;
    async function loadSubjects() {
      try {
        const data = isAuthenticated ? await listSubjects() : await listPublicSubjects();
        if (isMounted) {
          allSubjectsRef.current = data || [];
        }
      } catch (err) {
        console.error("Failed to load subjects for autocomplete:", err);
      }
    }
    loadSubjects();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions({ subjects: [], documents: [] });
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const lowerQ = trimmed.toLowerCase();
        const matchedSubjects = (allSubjectsRef.current || [])
          .filter(
            (s) =>
              (s.name || "").toLowerCase().includes(lowerQ) ||
              (s.code || "").toLowerCase().includes(lowerQ)
          )
          .slice(0, 3);

        const docRes = await searchPublicDocuments({ search: trimmed, limit: 5 });
        const matchedDocs = docRes?.documents || [];

        setSuggestions({ subjects: matchedSubjects, documents: matchedDocs });
        setIsOpen(true);
        setHighlightedIndex(-1);
      } catch (err) {
        console.error("Autocomplete search error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function getFlatList() {
    const items = [];
    suggestions.subjects.forEach((s) => items.push({ type: "subject", data: s }));
    suggestions.documents.forEach((d) => items.push({ type: "document", data: d }));
    if (query.trim()) {
      items.push({ type: "search", query: query.trim() });
    }
    return items;
  }

  function handleSearchSubmit(searchQuery) {
    const q = searchQuery.trim();
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    setIsOpen(false);
    navigate(`/public-documents${params}`);
  }

  function handleSelectItem(item) {
    setIsOpen(false);
    if (item.type === "subject") {
      navigate(`/public-documents?subjectId=${item.data.id}`);
    } else if (item.type === "document") {
      navigate(`/public-documents/${item.data.id}`);
    } else {
      handleSearchSubmit(query);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const flatList = getFlatList();
    if (isOpen && highlightedIndex >= 0 && flatList[highlightedIndex]) {
      handleSelectItem(flatList[highlightedIndex]);
      return;
    }
    handleSearchSubmit(query);
  }

  function handleKeyDown(e) {
    if (!isOpen) return;
    const flatList = getFlatList();
    if (!flatList.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < flatList.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : flatList.length - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  const flatList = getFlatList();
  let currentIndexTracker = 0;

  return (
    <div className="relative mx-auto max-w-2xl" ref={containerRef}>
      <form
        className="flex max-w-2xl flex-col gap-3 rounded-2xl bg-white p-2 shadow-[0_16px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 sm:flex-row sm:items-center"
        onSubmit={handleSubmit}
        role="search"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
          <svg
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            aria-label="Search study documents"
            className="h-12 flex-1 min-w-0 border-0 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 py-0"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query.trim() && (suggestions.subjects.length > 0 || suggestions.documents.length > 0)) {
                setIsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search by course, title, or subject code..."
            type="search"
            autoComplete="off"
          />
          {isLoading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          )}
        </div>
        <button
          className="min-h-12 shrink-0 cursor-pointer rounded-xl bg-indigo-600 px-8 text-sm font-bold text-white transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          type="submit"
        >
          Search
        </button>
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && flatList.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-2 shadow-2xl backdrop-blur-md">
          {/* Courses / Subjects Section */}
          {suggestions.subjects.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Courses &amp; Subjects
              </div>
              {suggestions.subjects.map((subject) => {
                const itemIndex = currentIndexTracker++;
                const isHighlighted = highlightedIndex === itemIndex;
                return (
                  <button
                    key={`sub-${subject.id}`}
                    type="button"
                    onClick={() => handleSelectItem({ type: "subject", data: subject })}
                    onMouseEnter={() => setHighlightedIndex(itemIndex)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      isHighlighted
                        ? "bg-indigo-50 text-indigo-900 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                        <FolderIcon className="h-4 w-4" />
                      </div>
                      <span className="truncate">{subject.name}</span>
                    </div>
                    <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 uppercase shrink-0">
                      {subject.code}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Documents Section */}
          {suggestions.documents.length > 0 && (
            <div className="mb-1">
              <div className="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Study Documents
              </div>
              {suggestions.documents.map((doc) => {
                const itemIndex = currentIndexTracker++;
                const isHighlighted = highlightedIndex === itemIndex;
                return (
                  <button
                    key={`doc-${doc.id}`}
                    type="button"
                    onClick={() => handleSelectItem({ type: "document", data: doc })}
                    onMouseEnter={() => setHighlightedIndex(itemIndex)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      isHighlighted
                        ? "bg-indigo-50 text-indigo-900 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                        <DocIcon className="h-4 w-4" />
                      </div>
                      <div className="truncate min-w-0">
                        <div className="truncate text-slate-800">{doc.title}</div>
                        {doc.subjectCode && (
                          <div className="text-[10px] font-bold text-teal-600 uppercase">
                            {doc.subjectCode}
                          </div>
                        )}
                      </div>
                    </div>
                    {doc.fileType && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500 shrink-0">
                        {doc.fileType}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer search action */}
          {query.trim() && (() => {
            const itemIndex = currentIndexTracker++;
            const isHighlighted = highlightedIndex === itemIndex;
            return (
              <button
                type="button"
                onClick={() => handleSelectItem({ type: "search", query })}
                onMouseEnter={() => setHighlightedIndex(itemIndex)}
                className={`mt-1 flex w-full cursor-pointer items-center justify-between rounded-xl border-t border-slate-100 px-3 py-2.5 text-left text-xs font-bold transition ${
                  isHighlighted
                    ? "bg-indigo-600 text-white"
                    : "text-indigo-600 hover:bg-indigo-50"
                }`}
              >
                <span>Search all results for &ldquo;{query.trim()}&rdquo;</span>
                <span>&rarr;</span>
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
}

