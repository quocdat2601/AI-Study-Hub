import React from "react";
import { getStatusLabel, getSubjectLabel } from "./workspaceDisplay.js";

export default function DocumentSidebar({ documents, isLoadingDocs, onSelectDocument, selectedId }) {
  return (
    <aside className="border-b border-[#d8deea] bg-white p-4 lg:h-full lg:overflow-hidden lg:border-b-0 lg:border-r">
      <div className="mb-4">
        <h1 className="m-0 text-lg font-extrabold">Test Workspace</h1>
        <p className="mt-1 text-xs text-[#66758a]">Temporary page for AI document Q&A.</p>
      </div>

      {isLoadingDocs ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => <div className="h-20 animate-pulse rounded-lg bg-[#eef2f8]" key={item} />)}
        </div>
      ) : documents.length ? (
        <div className="grid max-h-[calc(100vh-160px)] gap-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-170px)]">
          {documents.map((doc) => (
            <button
              className={
                Number(selectedId) === Number(doc.id)
                  ? "rounded-lg border border-[#4648d4] bg-[#eef0ff] p-3 text-left shadow-sm"
                  : "rounded-lg border border-[#d8deea] bg-white p-3 text-left transition hover:border-[#4648d4]"
              }
              key={doc.id}
              onClick={() => onSelectDocument(doc.id)}
              type="button"
            >
              <strong className="line-clamp-2 block text-sm">{doc.title}</strong>
              <span className="mt-2 block text-xs font-bold text-[#4648d4]">{getSubjectLabel(doc)}</span>
              <span className="mt-1 block text-xs text-[#66758a]">{getStatusLabel(doc)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[#c7c4d7] p-4 text-sm text-[#66758a]">No documents available.</p>
      )}
    </aside>
  );
}
