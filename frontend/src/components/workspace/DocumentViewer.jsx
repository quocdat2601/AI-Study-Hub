import React from "react";
import { getStatusLabel, getSubjectLabel } from "./workspaceDisplay.js";

export default function DocumentViewer({ isProcessing, onReprocess, processResult, selectedDocument }) {
  return (
    <section className="min-w-0 overflow-y-auto p-5">
      {selectedDocument ? (
        <div className="grid gap-4">
          <article className="rounded-xl border border-[#d8deea] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="m-0 text-xs font-black uppercase tracking-[0.08em] text-[#4648d4]">{getSubjectLabel(selectedDocument)}</p>
                <h2 className="mt-2 mb-1 text-2xl font-extrabold">{selectedDocument.title}</h2>
                <p className="m-0 text-sm text-[#66758a]">{getStatusLabel(selectedDocument)}</p>
              </div>
              {processResult ? (
                <button
                  className="rounded-full border border-[#c7c4d7] bg-white px-3 py-1.5 text-xs font-bold text-[#66758a] transition hover:border-[#4648d4] hover:text-[#4648d4] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isProcessing}
                  onClick={onReprocess}
                  type="button"
                >
                  {isProcessing ? "Re-processing..." : "Re-process"}
                </button>
              ) : null}
            </div>

            {processResult ? (
              <p className="mt-4 rounded-lg bg-[#eef0ff] px-3 py-2 text-sm text-[#344154]">
                {Number.isFinite(processResult.chunkCount)
                  ? `Ready for document Q&A with ${processResult.chunkCount} chunk${processResult.chunkCount === 1 ? "" : "s"}.`
                  : "Document context is ready for this answer."}
              </p>
            ) : null}
          </article>

          <article className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-[#c7c4d7] bg-white p-6 text-center">
            <div>
              {selectedDocument.thumbnailUrl ? (
                <img className="mx-auto max-h-[340px] rounded-lg border border-[#d8deea] object-contain" src={selectedDocument.thumbnailUrl} alt="" />
              ) : (
                <div className="mx-auto flex h-56 w-44 items-center justify-center rounded-lg border border-[#d8deea] bg-[#f7f9fb] text-sm font-bold text-[#66758a]">
                  Document preview
                </div>
              )}
              <p className="mt-4 text-sm text-[#66758a]">Final viewer is not ready yet, so this panel is only a placeholder.</p>
            </div>
          </article>
        </div>
      ) : (
        <div className="rounded-xl border border-[#d8deea] bg-white p-8 text-center text-[#66758a]">Select a document to begin.</div>
      )}
    </section>
  );
}
