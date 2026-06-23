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

function getDocumentType(document) {
  const mime = document?.cloud_files?.mime_type || document?.mime_type || "";
  const title = document?.title || document?.name || "";
  if (mime.includes("pdf") || title.toLowerCase().endsWith(".pdf")) return "PDF";
  if (mime.includes("word") || title.toLowerCase().endsWith(".docx")) return "DOCX";
  return document?.file_type || document?.type || "DOC";
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

function ViewToggle({ disabledPdf, setViewMode, viewMode }) {
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
        PDF
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
  currentPage,
  isPdfLoading,
  onReloadPdf,
  pdfBlobUrl,
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

  if (viewMode === "text" || documentType !== "PDF") {
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
  const [notebookCount, setNotebookCount] = useState(0);
  const documentType = getDocumentType(selectedDocument);

  useEffect(() => {
    setNotebookCount(0);
    setShowNotebookPanel(false);
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

  return (
    <section className={`flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm ${className}`}>
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex min-h-14 items-center gap-3 px-4 py-2">
          <ViewToggle disabledPdf={documentType !== "PDF"} setViewMode={setViewMode} viewMode={viewMode} />

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileTextIcon className="shrink-0 text-indigo-600" size={15} />
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-semibold text-slate-900">
                {selectedDocument?.title || "Select a document"}
              </p>
              {selectedDocument ? (
                <p className="m-0 mt-0.5 flex items-center gap-2 text-[11px] font-medium text-slate-500">
                  <span>{getSubjectLabel(selectedDocument)}</span>
                  <span className="text-slate-300">|</span>
                  <span>{documentType}</span>
                  <span className="text-slate-300">|</span>
                  <span>{getStatusLabel(selectedDocument)}</span>
                </p>
              ) : null}
            </div>
          </div>

          {selectedDocument && status === "ready" ? (
            <span className="no-caret rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">AI ready</span>
          ) : null}

          {showPdfControls ? (
            <div className="no-caret hidden shrink-0 items-center gap-1.5 text-[12px] text-slate-600 xl:flex">
              <button className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 transition hover:bg-slate-50" onClick={() => changeZoom(-10)} type="button">-</button>
              <span className="min-w-10 text-center font-medium">{zoom}%</span>
              <button className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 transition hover:bg-slate-50" onClick={() => changeZoom(10)} type="button">+</button>
              <span className="mx-0.5 text-slate-300">|</span>
              <button className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 transition hover:bg-slate-50 disabled:opacity-40" disabled={currentPage <= 1} onClick={() => jumpToPage(Math.max(1, currentPage - 1))} type="button">Prev</button>
              <span className="min-w-[76px] text-center font-medium">{currentPage}/{totalPages || 1}</span>
              <button className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 transition hover:bg-slate-50 disabled:opacity-40" disabled={currentPage >= totalPages} onClick={() => jumpToPage(Math.min(totalPages || 1, currentPage + 1))} type="button">Next</button>
            </div>
          ) : null}

          {selectedDocument ? (
            <button
              className="cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isProcessing}
              onClick={onReprocess}
              type="button"
            >
              {isProcessing ? "Processing..." : "Re-process"}
            </button>
          ) : null}

          {selectedDocument ? (
            <button
              className={showNotebookPanel
                ? "cursor-pointer rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                : "cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"}
              onClick={() => setShowNotebookPanel((value) => !value)}
              type="button"
            >
              Notebook ({notebookCount})
            </button>
          ) : null}

          <button
            aria-label="Download document"
            className="cursor-pointer rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!pdfBlobUrl}
            onClick={handleDownload}
            type="button"
          >
            <DownloadIcon size={14} />
          </button>
        </div>
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
