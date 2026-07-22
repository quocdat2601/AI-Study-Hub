import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document } from "react-pdf";
import "../../lib/pdfWorker.js";
import { PDF_DOCUMENT_OPTIONS } from "../../lib/pdfWorker.js";
import WorkspaceLazyPdfPage from "./WorkspaceLazyPdfPage.jsx";
import WorkspaceTextView from "./WorkspaceTextView.jsx";
import WorkspaceNotebook from "./WorkspaceNotebook.jsx";
import { loadNotebookNotes } from "../../utils/workspaceNotebook.js";
import { DownloadIcon, FileTextIcon } from "./WorkspaceIcons.jsx";
import { getStatusLabel, getSubjectLabel } from "./workspaceDisplay.js";
import { formatFileSize } from "../../lib/formatFileSize.js";

function getDocumentType(document) {
  const mime = document?.cloud_files?.mime_type || document?.mime_type || "";
  const title = document?.title || document?.name || "";
  if (mime.includes("pdf") || title.toLowerCase().endsWith(".pdf")) return "PDF";
  if (mime.includes("word") || title.toLowerCase().endsWith(".docx")) return "DOCX";
  return document?.file_type || document?.type || "DOC";
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileSize(document) {
  return document?.cloud_files?.size_bytes || document?.fileSizeBytes || document?.size_bytes || 0;
}

function mapTextDocument(document) {
  if (!document) return null;
  return {
    ...document,
    type: getDocumentType(document),
    extractedText: document.extractedText || document.extracted_text || "",
    extractionStatus: document.extractionStatus || document.extraction_status,
    extractionError: document.extractionError || document.extraction_error,
  };
}

function ViewToggle({ disabledPdf, setViewMode, viewMode, isPdf, isDocx }) {
  return (
    <div className="flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      <button
        className={viewMode === "pdf"
          ? "cursor-pointer rounded-md border-0 bg-white px-3 py-1.5 text-[12px] font-semibold text-indigo-700 shadow-sm"
          : "cursor-pointer rounded-md border-0 bg-transparent px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"}
        disabled={disabledPdf}
        onClick={() => setViewMode("pdf")}
        type="button"
      >
        {isPdf ? "PDF" : (isDocx ? "Document" : "Viewer")}
      </button>
      <button
        className={viewMode === "text"
          ? "cursor-pointer rounded-md border-0 bg-white px-3 py-1.5 text-[12px] font-semibold text-indigo-700 shadow-sm"
          : "cursor-pointer rounded-md border-0 bg-transparent px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition hover:text-slate-800"}
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

function PdfBody({
  isPdfLoading,
  onReloadPdf,
  pdfBlobUrl,
  docxSignedUrl,
  pdfLoadError,
  selectedDocument,
  setCurrentPage,
  setTotalPages,
  viewMode,
  zoom,
}) {
  const [pdfError, setPdfError] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [pagesReady, setPagesReady] = useState(false);
  const isJumpingRef = useRef(false);
  const textDocument = mapTextDocument(selectedDocument);
  const documentType = getDocumentType(selectedDocument);
  const pageWidth = Math.round(620 * (zoom / 100));
  const pdfFile = useMemo(() => (pdfBlobUrl ? { url: pdfBlobUrl } : null), [pdfBlobUrl]);

  useEffect(() => {
    setPdfError(false);
    setNumPages(0);
    setPagesReady(false);
    setCurrentPage(1);
  }, [pdfBlobUrl, selectedDocument?.id, setCurrentPage]);

  const handleLoadSuccess = useCallback(({ numPages: loadedPages }) => {
    setNumPages(loadedPages);
    setTotalPages(loadedPages);
    window.requestAnimationFrame(() => setPagesReady(true));
  }, [setTotalPages]);

  const handlePageVisible = useCallback((pageNumber) => {
    if (isJumpingRef.current) return;
    setCurrentPage(pageNumber);
  }, [setCurrentPage]);

  useEffect(() => {
    function onJump(event) {
      const page = Number(event.detail?.page);
      if (!page) return;

      isJumpingRef.current = true;
      setCurrentPage(page);
      window.document.getElementById(`workspace-pdf-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        isJumpingRef.current = false;
      }, 450);
    }

    window.addEventListener("workspace-jump-to-page", onJump);
    return () => window.removeEventListener("workspace-jump-to-page", onJump);
  }, [setCurrentPage]);

  if (!selectedDocument) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 text-center text-sm text-slate-500">
        Select a document from the sidebar to preview it here.
      </div>
    );
  }

  if (viewMode === "text") {
    return <WorkspaceTextView document={textDocument} />;
  }

  if (documentType === "DOCX" && docxSignedUrl) {
    return (
      <iframe
        title="Document Preview"
        className="w-full border-0 bg-white"
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(docxSignedUrl)}`}
        style={{ minHeight: "calc(100vh - 165px)" }}
      />
    );
  }

  if (documentType !== "PDF") {
    return <WorkspaceTextView document={textDocument} />;
  }

  if (isPdfLoading || !pdfFile) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        <p className="m-0 font-medium">Loading PDF preview...</p>
        <p className="m-0 text-xs text-slate-400">Large files can take a moment.</p>
      </div>
    );
  }

  if (pdfLoadError || pdfError) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-red-600">
        <p className="m-0">{pdfLoadError || "Could not display this PDF. Try reload or switch to Text view."}</p>
        <button
          className="cursor-pointer rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
          onClick={onReloadPdf}
          type="button"
        >
          Reload PDF
        </button>
      </div>
    );
  }

  return (
    <div className="workspace-selectable min-h-full bg-[#eef0f2] px-4 py-8 pr-6 sm:px-8 sm:pr-10">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5">
        <Document
          error={<div className="rounded-sm bg-white p-10 text-center text-sm text-red-600 shadow-md">Could not display PDF.</div>}
          file={pdfFile}
          key={selectedDocument.id}
          loading={
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-sm text-slate-500">
              <p className="m-0">Reading PDF structure...</p>
              <p className="m-0 text-xs text-slate-400">Please wait.</p>
            </div>
          }
          onLoadError={() => setPdfError(true)}
          onLoadSuccess={handleLoadSuccess}
          options={PDF_DOCUMENT_OPTIONS}
        >
          {pagesReady && numPages > 0
            ? Array.from({ length: numPages }, (_, index) => (
                <WorkspaceLazyPdfPage
                  key={`pdf-page-${index + 1}`}
                  onPageVisible={handlePageVisible}
                  pageNumber={index + 1}
                  width={pageWidth}
                />
              ))
            : null}
        </Document>
      </div>
    </div>
  );
}

export default function DocumentViewer({
  changeZoom,
  className = "",
  currentPage,
  isPdfLoading,
  isProcessing,
  onReloadPdf,
  onReprocess,
  pdfBlobUrl,
  docxSignedUrl,
  pdfLoadError,
  processResult,
  selectedDocument,
  setCurrentPage,
  setTotalPages,
  setViewMode,
  totalPages,
  viewMode,
  zoom,
}) {
  const [showNotebookPanel, setShowNotebookPanel] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [notebookCount, setNotebookCount] = useState(0);
  const documentType = getDocumentType(selectedDocument);

  useEffect(() => {
    setNotebookCount(0);
    setShowNotebookPanel(false);
    setShowProperties(false);
    if (!selectedDocument?.id) return undefined;

    let isMounted = true;
    loadNotebookNotes(selectedDocument.id)
      .then((items) => {
        if (isMounted) setNotebookCount(items.length);
      })
      .catch(() => {
        if (isMounted) setNotebookCount(0);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDocument?.id]);
  const showPdfControls = viewMode === "pdf" && documentType === "PDF" && selectedDocument;
  const status = processResult?.status || selectedDocument?.extraction_status || selectedDocument?.status;

  function handleDownload() {
    if (!selectedDocument || !pdfBlobUrl) return;
    const link = window.document.createElement("a");
    link.href = pdfBlobUrl;
    link.download = `${selectedDocument.title || "document"}.pdf`;
    link.click();
  }

  const isPdf = documentType === "PDF";
  const isDocx = documentType === "DOCX";
  const isPreviewable = isPdf || isDocx;

  return (
    <section className={`flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm ${className}`}>
      <header className="shrink-0 border-b border-slate-100 bg-white">
        {/* ── Row 1: View toggle + title + actions ── */}
        <div className="flex min-h-[52px] items-center gap-2.5 px-3 py-2">
          {/* View toggle */}
          <ViewToggle
            disabledPdf={!isPreviewable}
            setViewMode={setViewMode}
            viewMode={viewMode}
            isPdf={isPdf}
            isDocx={isDocx}
          />

          {/* Divider */}
          <div className="h-6 w-px bg-slate-200 shrink-0" />

          {/* File icon + title */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileTextIcon className="shrink-0 text-indigo-500" size={15} />
            <p className="m-0 truncate text-sm font-semibold text-slate-900 leading-snug">
              {selectedDocument?.title || (
                <span className="text-slate-400 font-normal">Select a document to begin</span>
              )}
            </p>
          </div>

          {/* ── Right-side action group ── */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Page navigation (PDF only, compact) */}
            {showPdfControls ? (
              <div className="hidden items-center gap-1 xl:flex">
                <button
                  className="cursor-pointer rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50"
                  onClick={() => changeZoom(-10)}
                  type="button"
                >
                  −
                </button>
                <span className="min-w-[38px] text-center text-[11px] font-medium text-slate-500">
                  {zoom}%
                </span>
                <button
                  className="cursor-pointer rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50"
                  onClick={() => changeZoom(10)}
                  type="button"
                >
                  +
                </button>
                <div className="mx-1 h-4 w-px bg-slate-200" />
                <button
                  className="cursor-pointer rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  disabled={currentPage <= 1}
                  onClick={() => jumpToPage(Math.max(1, currentPage - 1))}
                  type="button"
                >
                  ‹
                </button>
                <span className="min-w-[52px] text-center text-[11px] font-medium text-slate-500">
                  {currentPage}/{totalPages || 1}
                </span>
                <button
                  className="cursor-pointer rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  disabled={currentPage >= totalPages}
                  onClick={() => jumpToPage(Math.min(totalPages || 1, currentPage + 1))}
                  type="button"
                >
                  ›
                </button>
                <div className="mx-1 h-4 w-px bg-slate-200" />
              </div>
            ) : null}

            {/* Properties toggle */}
            {selectedDocument ? (
              <button
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                  showProperties
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setShowProperties((v) => !v)}
                type="button"
              >
                Details
              </button>
            ) : null}

            {/* Notebook toggle */}
            {selectedDocument ? (
              <button
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                  showNotebookPanel
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setShowNotebookPanel((v) => !v)}
                type="button"
              >
                Notes{notebookCount > 0 ? ` (${notebookCount})` : ""}
              </button>
            ) : null}

            {/* Re-process */}
            {selectedDocument ? (
              <button
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                disabled={isProcessing}
                onClick={onReprocess}
                title="Re-extract text from this document"
                type="button"
              >
                {isProcessing ? "Processing…" : "Re-process"}
              </button>
            ) : null}

            {/* Download */}
            <button
              aria-label="Download document"
              className="cursor-pointer rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!pdfBlobUrl}
              onClick={handleDownload}
              type="button"
            >
              <DownloadIcon size={13} />
            </button>
          </div>
        </div>

        {/* ── Row 2: meta chips ── */}
        {selectedDocument ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-1.5">
            {/* Subject */}
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
              📚 {getSubjectLabel(selectedDocument)}
            </span>

            {/* File type */}
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {documentType}
            </span>

            {/* Extraction status */}
            {(() => {
              const s = processResult?.status || selectedDocument?.extraction_status;
              if (s === "ready") {
                return (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    ✓ AI ready
                  </span>
                );
              }
              if (s === "empty") {
                return (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    ⚠ No text
                  </span>
                );
              }
              if (s === "failed") {
                return (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                    ✕ Failed
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  Processing…
                </span>
              );
            })()}

            {/* Tags */}
            {selectedDocument.tags?.length ? (
              <>
                <div className="h-3 w-px bg-slate-300" />
                {selectedDocument.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                  >
                    #{tag.name}
                  </span>
                ))}
              </>
            ) : null}
          </div>
        ) : null}

        {/* ── Properties panel (expandable) ── */}
        {selectedDocument && showProperties ? (
          <div className="grid gap-3 border-t border-slate-100 bg-white px-4 py-3 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <span className="block font-bold uppercase tracking-wide text-slate-400">Subject</span>
              <strong className="mt-0.5 block truncate text-slate-800">{getSubjectLabel(selectedDocument)}</strong>
            </div>
            <div>
              <span className="block font-bold uppercase tracking-wide text-slate-400">File</span>
              <strong className="mt-0.5 block truncate text-slate-800">
                {documentType} · {formatFileSize(getFileSize(selectedDocument))}
              </strong>
            </div>
            <div>
              <span className="block font-bold uppercase tracking-wide text-slate-400">Created</span>
              <strong className="mt-0.5 block truncate text-slate-800">{formatDateTime(selectedDocument.created_at)}</strong>
            </div>
            <div>
              <span className="block font-bold uppercase tracking-wide text-slate-400">Status</span>
              <strong className="mt-0.5 block truncate text-slate-800">{getStatusLabel(selectedDocument)}</strong>
            </div>
          </div>
        ) : null}
      </header>


      <div className="workspace-scrollbar workspace-selectable relative min-h-0 flex-1 overflow-y-auto bg-[#eef0f2]" id="workspace-viewer-area">
        <WorkspaceNotebook
          docId={selectedDocument?.id}
          onNotesChange={setNotebookCount}
          onTogglePanel={setShowNotebookPanel}
          showPanel={showNotebookPanel}
          viewMode={viewMode}
        >
          <PdfBody
            currentPage={currentPage}
            isPdfLoading={isPdfLoading}
            onReloadPdf={onReloadPdf}
            pdfBlobUrl={pdfBlobUrl}
            docxSignedUrl={docxSignedUrl}
            pdfLoadError={pdfLoadError}
            selectedDocument={selectedDocument}
            setCurrentPage={setCurrentPage}
            setTotalPages={setTotalPages}
            viewMode={viewMode}
            zoom={zoom}
          />
        </WorkspaceNotebook>
      </div>
    </section>
  );
}
