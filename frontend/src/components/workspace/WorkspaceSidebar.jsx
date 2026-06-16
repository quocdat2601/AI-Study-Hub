import React from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../contexts/WorkspaceContext.jsx";
import WorkspaceAccountFooter from "./WorkspaceAccountFooter.jsx";
import WorkspaceDocumentListItem from "./WorkspaceDocumentListItem.jsx";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
} from "./WorkspaceIcons.jsx";

const TABS = [
  { id: "all", label: "All" },
  { id: "recent", label: "Recent" },
  { id: "bookmarked", label: "Bookmarked" },
  { id: "shared", label: "Shared" },
];

function hasActiveFilters({ subjectFilter, fileTypeFilter, search }) {
  return Boolean(subjectFilter || fileTypeFilter || search.trim());
}

export default function WorkspaceSidebar({
  onNewDocument,
  width = 304,
  className = "",
  collapsed = false,
  onToggleCollapse,
}) {
  const {
    user,
    search,
    setSearch,
    activeTab,
    setActiveTab,
    subjectFilter,
    setSubjectFilter,
    fileTypeFilter,
    setFileTypeFilter,
    subjects,
    documents,
    isLoading,
    loadError,
    selectedDocId,
    selectDocument,
    bookmarkedDocIds,
    toggleBookmark,
    clearFilters,
    handleLogout,
  } = useWorkspace();

  const filtersActive = hasActiveFilters({ subjectFilter, fileTypeFilter, search });

  if (collapsed) {
    return (
      <div className={`relative shrink-0 ${className}`} style={{ width: 0 }}>
        <button
          aria-label="Expand sidebar"
          className="absolute left-0 top-1/2 z-30 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition hover:border-[#5b4fd4] hover:text-[#5b4fd4]"
          onClick={onToggleCollapse}
          type="button"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>
    );
  }

  return (
    <aside
      className={`relative flex shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white ${className}`}
      style={{ width }}
    >
      <button
        aria-label="Collapse sidebar"
        className="absolute -right-3 top-1/2 z-30 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#5b4fd4] hover:text-[#5b4fd4]"
        onClick={onToggleCollapse}
        type="button"
      >
        <ChevronLeftIcon size={14} />
      </button>

      <div className="px-4 pb-4 pt-5">
        <div className="mb-4 flex items-center gap-2">
          <Link
            aria-label="Back to dashboard"
            className="no-caret flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 no-underline transition hover:bg-slate-100 hover:text-slate-800"
            to="/dashboard"
          >
            <ChevronLeftIcon size={18} />
          </Link>
          <Link className="no-caret truncate text-[17px] font-bold text-[#5b4fd4] no-underline" to="/dashboard">
            AI Study Hub
          </Link>
        </div>

        <button
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#5b4fd4] px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4f45c4]"
          onClick={onNewDocument}
          type="button"
        >
          <PlusIcon size={16} />
          + New Document
        </button>
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <SearchIcon className="shrink-0 text-slate-400" size={15} />
            <input
              className="min-h-10 w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents..."
              value={search}
            />
          </div>
          <button
            aria-label="Filters active"
            className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition ${
              filtersActive
                ? "border-[#5b4fd4]/30 bg-[#eef3ff] text-[#5b4fd4]"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
            type="button"
          >
            <FilterIcon size={15} />
          </button>
        </div>

        <div className="no-caret mt-3 flex rounded-xl bg-slate-100 p-1">
          {TABS.map((tab) => (
            <button
              className={`flex-1 cursor-pointer rounded-lg border-0 px-1 py-2 text-[11px] font-semibold transition ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "bg-transparent text-slate-500 hover:text-slate-700"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="no-caret text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Filter options
          </span>
          <button
            className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-[#5b4fd4] hover:underline"
            onClick={clearFilters}
            type="button"
          >
            Clear filters
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="relative block">
            <select
              className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-xs font-medium text-slate-700 outline-none"
              onChange={(event) => setSubjectFilter(event.target.value)}
              value={subjectFilter}
            >
              <option value="">Subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
          </label>

          <label className="relative block">
            <select
              className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-xs font-medium text-slate-700 outline-none"
              onChange={(event) => setFileTypeFilter(event.target.value)}
              value={fileTypeFilter}
            >
              <option value="">File Type</option>
              <option value="PDF">PDF</option>
              <option value="DOCX">DOCX</option>
            </select>
            <ChevronDownIcon
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
          </label>
        </div>
      </div>

      <div className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto border-t border-slate-100 py-1">
        {loadError ? (
          <p className="px-4 py-4 text-sm text-red-600">{loadError}</p>
        ) : null}
        {isLoading ? (
          <p className="px-4 py-4 text-sm text-slate-500">Loading documents...</p>
        ) : documents.length ? (
          documents.map((document) => (
            <WorkspaceDocumentListItem
              document={document}
              isBookmarked={bookmarkedDocIds.has(document.id)}
              isSelected={selectedDocId === document.id}
              key={document.id}
              onSelect={selectDocument}
              onToggleBookmark={toggleBookmark}
            />
          ))
        ) : (
          <p className="px-4 py-4 text-sm leading-relaxed text-slate-500">
            No documents found. Upload a PDF to start studying with AI.
          </p>
        )}
      </div>

      <WorkspaceAccountFooter onLogout={handleLogout} user={user} />
    </aside>
  );
}
