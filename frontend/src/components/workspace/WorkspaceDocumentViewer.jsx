import React from "react";
import { useWorkspace } from "../../contexts/WorkspaceContext.jsx";
import WorkspacePDFViewer from "./WorkspacePDFViewer.jsx";
import { DownloadIcon, FileTextIcon } from "./WorkspaceIcons.jsx";

function ViewToggle({ viewMode, setViewMode }) {
  return (
    <div className="flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      <button
        className={`cursor-pointer rounded-md border-0 px-3 py-1.5 text-[12px] font-semibold transition ${
          viewMode === "pdf"
            ? "bg-white text-indigo-700 shadow-sm"
            : "bg-transparent text-slate-500 hover:text-slate-800"
        }`}
        onClick={() => setViewMode("pdf")}
        type="button"
      >
        PDF
      </button>
      <button
        className={`cursor-pointer rounded-md border-0 px-3 py-1.5 text-[12px] font-semibold transition ${
          viewMode === "text"
            ? "bg-white text-indigo-700 shadow-sm"
            : "bg-transparent text-slate-500 hover:text-slate-800"
        }`}
        onClick={() => setViewMode("text")}
        type="button"
      >
        Text
      </button>
    </div>
  );
}

function jumpToPage(page) {
  window.dispatchEvent(new CustomEvent("workspace-jump-to-page", { detail: { page } }));
}

export default function WorkspaceDocumentViewer({ className = "" }) {
  const {
    selectedDocument,
    currentPage,
    totalPages,
    zoom,
    changeZoom,
    viewMode,
    setViewMode,
    pdfUrl,
    pdfBlobUrl,
  } = useWorkspace();

  function handleDownload() {
    if (!selectedDocument) return;

    const link = window.document.createElement("a");
    if (pdfBlobUrl) {
      link.href = pdfBlobUrl;
      link.download = `${selectedDocument.title || "document"}.pdf`;
      link.click();
      return;
    }

    if (!pdfUrl) return;
    link.href = pdfUrl;
    link.download = selectedDocument.title || "document";
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
  }

  const showPdfControls = viewMode === "pdf" && selectedDocument?.type === "PDF";

  return (
    <section className={`flex flex-col overflow-hidden ${className}`}>
      <header className="shrink-0 rounded-t-xl border border-b-0 border-slate-200/80 bg-white">
        <div className="flex h-14 items-center gap-3 px-4">
          <ViewToggle setViewMode={setViewMode} viewMode={viewMode} />

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileTextIcon className="shrink-0 text-indigo-600" size={15} />
            <span className="truncate text-sm font-medium text-slate-800">
              {selectedDocument?.title || "Chọn tài liệu"}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 text-[12px] text-slate-600">
            {showPdfControls ? (
              <>
                <button
                  className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 transition hover:bg-slate-50"
                  onClick={() => changeZoom(-10)}
                  type="button"
                >
                  −
                </button>
                <span className="min-w-10 text-center font-medium">{zoom}%</span>
                <button
                  className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 transition hover:bg-slate-50"
                  onClick={() => changeZoom(10)}
                  type="button"
                >
                  +
                </button>
                <span className="mx-0.5 text-slate-300">|</span>
                <button
                  className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 transition hover:bg-slate-50 disabled:opacity-40"
                  disabled={currentPage <= 1}
                  onClick={() => jumpToPage(Math.max(1, currentPage - 1))}
                  type="button"
                >
                  Prev
                </button>
                <span className="min-w-[76px] text-center font-medium">
                  {currentPage}/{totalPages}
                </span>
                <button
                  className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 transition hover:bg-slate-50 disabled:opacity-40"
                  disabled={currentPage >= totalPages}
                  onClick={() => jumpToPage(Math.min(totalPages, currentPage + 1))}
                  type="button"
                >
                  Next
                </button>
              </>
            ) : null}

            <button
              aria-label="Download document"
              className="ml-1 cursor-pointer rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50"
              onClick={handleDownload}
              type="button"
            >
              <DownloadIcon size={14} />
            </button>
          </div>
        </div>

      </header>

      <div
        className="workspace-scrollbar min-h-0 flex-1 select-text overflow-y-auto rounded-b-xl border border-t-0 border-slate-200/80 bg-[#eef0f2]"
        id="workspace-viewer-area"
      >
        <WorkspacePDFViewer />
      </div>
    </section>
  );
}
