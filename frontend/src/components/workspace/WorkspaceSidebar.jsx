import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, LogOut, Search, Settings, SlidersHorizontal } from "lucide-react";
import { getDisplayName, getUserInitials } from "../../lib/userDisplay.js";
import DocumentListItem from "./DocumentListItem.jsx";
import FilterBar from "./FilterBar.jsx";

const TABS = [
  { id: "all", label: "All" },
  { id: "recent", label: "Recent" },
  { id: "bookmarked", label: "Bookmarked" },
  { id: "shared", label: "Shared" },
];

export default function WorkspaceSidebar({
  user,
  logout,
  subjects,
  search,
  setSearch,
  activeTab,
  setActiveTab,
  subjectFilter,
  setSubjectFilter,
  fileTypeFilter,
  setFileTypeFilter,
  clearFilters,
  filteredDocuments,
  selectedDocId,
  selectDocument,
  toggleBookmark,
  isLoadingDocs,
  loadError,
}) {
  const displayName = getDisplayName(user);
  const initials = getUserInitials(user);

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-panel)]">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="mb-4 flex items-center gap-2">
          <Link
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] no-underline hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title="Back to dashboard"
            to="/dashboard"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white shadow-[0_8px_20px_rgba(91,106,248,0.28)]">
            A
          </span>
          <div>
            <strong className="block text-[15px] font-bold text-[var(--text-primary)]">AI Study Hub</strong>
            <span className="text-[13px] text-[var(--text-muted)]">Study workspace</span>
          </div>
        </div>

        <Link
          className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--accent)] text-[15px] font-semibold text-white no-underline shadow-[0_10px_24px_rgba(91,106,248,0.22)] transition hover:bg-[var(--accent-hover)]"
          to="/documents?upload=true"
        >
          + New Document
        </Link>
      </div>

      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] pl-10 pr-10 text-[15px] text-[var(--text-primary)] shadow-[var(--shadow-soft)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search documents..."
            type="search"
            value={search}
          />
          <button
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded border-0 bg-transparent text-[var(--text-muted)]"
            type="button"
            aria-label="Filters"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        <div className="mt-3 flex gap-4 overflow-x-auto border-b border-[var(--border)] pb-2.5 text-[13px]">
          {TABS.map((tab) => (
            <button
              className={`shrink-0 border-0 bg-transparent pb-1.5 text-[13px] font-semibold transition ${
                activeTab === tab.id
                  ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                  : "border-b-2 border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <FilterBar
          clearFilters={clearFilters}
          fileTypeFilter={fileTypeFilter}
          setFileTypeFilter={setFileTypeFilter}
          setSubjectFilter={setSubjectFilter}
          subjectFilter={subjectFilter}
          subjects={subjects}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto workspace-scroll-hidden px-1 py-2">
        {isLoadingDocs ? (
          <p className="px-2 py-4 text-[13px] text-[var(--text-muted)]">Loading documents...</p>
        ) : null}
        {loadError ? (
          <p className="px-2 py-4 text-[13px] text-red-400">{loadError}</p>
        ) : null}
        {!isLoadingDocs && filteredDocuments.length === 0 ? (
          <p className="px-2 py-4 text-[13px] text-[var(--text-muted)]">No documents found.</p>
        ) : null}
        {filteredDocuments.map((doc) => (
          <DocumentListItem
            doc={doc}
            isSelected={selectedDocId === doc.id}
            key={doc.id}
            onSelect={selectDocument}
            onToggleBookmark={toggleBookmark}
          />
        ))}
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--bg-base)] px-4 py-4">
        <Link
          className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--bg-panel)] p-3 no-underline shadow-[var(--shadow-soft)] transition hover:bg-[var(--bg-hover)]"
          to="/account"
        >
          {user?.avatarUrl ? (
            <img alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" src={user.avatarUrl} />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[13px] font-bold text-white">
              {initials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[15px] font-semibold text-[var(--text-primary)]">
              {displayName}
            </strong>
            <span className="block truncate text-[13px] font-medium text-[var(--accent)]">
              {user?.plan || "Student Plan"}
            </span>
          </div>
        </Link>

        <Link
          className="mb-1.5 flex h-10 w-full items-center gap-2.5 rounded-lg bg-[var(--bg-panel)] px-3 text-[14px] font-medium text-[var(--text-secondary)] no-underline shadow-[var(--shadow-soft)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          to="/account"
        >
          <Settings size={17} />
          Settings
        </Link>

        <button
          className="flex h-10 w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 text-left text-[14px] font-medium text-[var(--text-secondary)] transition hover:bg-red-50 hover:text-red-600"
          onClick={logout}
          type="button"
        >
          <LogOut size={17} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
