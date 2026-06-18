import React, { useMemo, useState } from "react";
import WorkspaceDocumentListItem from "./WorkspaceDocumentListItem.jsx";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
} from "./WorkspaceIcons.jsx";
import { getSubjectLabel } from "./workspaceDisplay.js";

const TABS = [
  { id: "all", label: "All" },
  { id: "recent", label: "Recent" },
  { id: "bookmarked", label: "Bookmarked" },
  { id: "shared", label: "Shared" },
];

function getDocumentType(document) {
  const mime = document.cloud_files?.mime_type || document.mime_type || "";
  const title = document.title || document.name || "";
  if (mime.includes("pdf") || title.toLowerCase().endsWith(".pdf")) return "PDF";
  if (mime.includes("word") || title.toLowerCase().endsWith(".docx")) return "DOCX";
  return document.file_type || document.type || "DOC";
}

function getDocumentDate(document) {
  const value = document.updated_at || document.created_at;
  if (!value) return "Recently";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mapListDocument(document) {
  return {
    ...document,
    subject: getSubjectLabel(document),
    date: getDocumentDate(document),
    type: getDocumentType(document),
  };
}

function matchesTab(document, activeTab) {
  if (activeTab === "recent") return true;
  if (activeTab === "bookmarked") return Boolean(document.isBookmarked || document.bookmarked);
  if (activeTab === "shared") return Boolean(document.is_shared || document.shared);
  return true;
}

export default function DocumentSidebar({
  collapsed = false,
  documents,
  isLoadingDocs,
  onNewDocument,
  onSelectDocument,
  onToggleCollapse,
  selectedId,
  width = 304,
}) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("");

  const subjects = useMemo(() => {
    const seen = new Map();
    documents.forEach((document) => {
      const label = getSubjectLabel(document);
      if (label && !seen.has(label)) seen.set(label, label);
    });
    return Array.from(seen.values());
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents
      .map(mapListDocument)
      .filter((document) => matchesTab(document, activeTab))
      .filter((document) => !query || String(document.title || "").toLowerCase().includes(query))
      .filter((document) => !subjectFilter || document.subject === subjectFilter)
      .filter((document) => !fileTypeFilter || document.type === fileTypeFilter);
  }, [activeTab, documents, fileTypeFilter, search, subjectFilter]);

  function clearFilters() {
    setSearch("");
    setSubjectFilter("");
    setFileTypeFilter("");
    setActiveTab("all");
  }

  if (collapsed) {
    return (
      <div className="relative shrink-0" style={{ width: 0 }}>
        <button
          aria-label="Expand document sidebar"
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
      className="relative flex shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"
      style={{ width }}
    >
      <button
        aria-label="Collapse document sidebar"
        className="absolute -right-3 top-1/2 z-30 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#5b4fd4] hover:text-[#5b4fd4]"
        onClick={onToggleCollapse}
        type="button"
      >
        <ChevronLeftIcon size={14} />
      </button>

      <div className="px-4 pb-4 pt-5">
        <div className="mb-4">
          <p className="no-caret m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
          <h1 className="no-caret m-0 mt-1 truncate text-[18px] font-extrabold text-slate-900">My Documents</h1>
        </div>

        {onNewDocument ? (
          <button
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#5b4fd4] px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4f45c4]"
            onClick={onNewDocument}
            type="button"
          >
            <PlusIcon size={16} />
            New Document
          </button>
        ) : null}
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#5b4fd4] focus-within:ring-2 focus-within:ring-[#e4e7ff]">
            <SearchIcon className="shrink-0 text-slate-400" size={15} />
            <input
              className="min-h-10 w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents..."
              value={search}
            />
          </label>
          <button
            aria-label="Clear filters"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            onClick={clearFilters}
            type="button"
          >
            <FilterIcon size={15} />
          </button>
        </div>

        <div className="no-caret mt-3 flex rounded-xl bg-slate-100 p-1">
          {TABS.map((tab) => (
            <button
              className={activeTab === tab.id
                ? "flex-1 cursor-pointer rounded-lg border-0 bg-white px-1 py-2 text-[11px] font-semibold text-slate-900 shadow-sm"
                : "flex-1 cursor-pointer rounded-lg border-0 bg-transparent px-1 py-2 text-[11px] font-semibold text-slate-500 transition hover:text-slate-700"}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="relative block">
            <select
              className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-xs font-medium text-slate-700 outline-none"
              onChange={(event) => setSubjectFilter(event.target.value)}
              value={subjectFilter}
            >
              <option value="">Subject</option>
              {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
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
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          </label>
        </div>
      </div>

      <div className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto border-t border-slate-100 py-1">
        {isLoadingDocs ? (
          <div className="grid gap-2 px-4 py-4">
            {[0, 1, 2, 3].map((item) => (
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" key={item} />
            ))}
          </div>
        ) : visibleDocuments.length ? (
          visibleDocuments.map((document) => (
            <WorkspaceDocumentListItem
              document={document}
              isBookmarked={Boolean(document.isBookmarked || document.bookmarked)}
              isSelected={Number(selectedId) === Number(document.id)}
              key={document.id}
              onSelect={onSelectDocument}
              onToggleBookmark={() => {}}
            />
          ))
        ) : (
          <p className="px-4 py-4 text-sm leading-relaxed text-slate-500">
            No documents found. Upload or adjust filters to continue.
          </p>
        )}
      </div>
    </aside>
  );
}
