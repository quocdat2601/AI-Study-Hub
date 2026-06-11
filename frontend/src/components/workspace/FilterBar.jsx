import React from "react";

export default function FilterBar({
  subjects,
  subjectFilter,
  setSubjectFilter,
  fileTypeFilter,
  setFileTypeFilter,
  clearFilters,
}) {
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Filter Options
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <select
          className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2.5 text-[var(--text-secondary)] outline-none focus:border-[var(--accent)]"
          onChange={(event) => setSubjectFilter(event.target.value)}
          value={subjectFilter}
        >
          <option value="">Subject</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code || subject.name}
            </option>
          ))}
        </select>

        <select
          className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2.5 text-[var(--text-secondary)] outline-none focus:border-[var(--accent)]"
          onChange={(event) => setFileTypeFilter(event.target.value)}
          value={fileTypeFilter}
        >
          <option value="">File Type</option>
          <option value="PDF">PDF</option>
          <option value="DOCX">DOCX</option>
          <option value="FILE">FILE</option>
        </select>

        <button
          className="border-0 bg-transparent p-0 text-[13px] font-medium text-[var(--accent)] hover:underline"
          onClick={clearFilters}
          type="button"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
