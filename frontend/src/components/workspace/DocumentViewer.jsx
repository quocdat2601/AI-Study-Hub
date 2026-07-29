import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document } from "react-pdf";
import "../../lib/pdfWorker.js";
import { PDF_DOCUMENT_OPTIONS } from "../../lib/pdfWorker.js";
import WorkspaceLazyPdfPage from "./WorkspaceLazyPdfPage.jsx";
import WorkspaceTextView from "./WorkspaceTextView.jsx";
import WorkspaceDocxViewer from "./WorkspaceDocxViewer.jsx";
import WorkspaceNotebook from "./WorkspaceNotebook.jsx";
import WorkspaceNotesPopover from "./WorkspaceNotesPopover.jsx";
import WorkspaceResizeHandle from "./WorkspaceResizeHandle.jsx";
import { loadNotebookNotes, removeNotebookNote } from "../../utils/workspaceNotebook.js";
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
    extractionMetadata: document.extractionMetadata || null,
  };
}


function ViewToggle({ disabledPdf, setViewMode, viewMode, isPdf, isDocx }) {
  const activeClass = "cursor-pointer rounded-md border-0 bg-white px-3 py-1.5 text-[12px] font-semibold text-indigo-700 shadow-sm";
  const inactiveClass = "cursor-pointer rounded-md border-0 bg-transparent px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      <button
        className={viewMode === "pdf" ? activeClass : inactiveClass}
        disabled={disabledPdf}
        onClick={() => setViewMode("pdf")}
        type="button"
      >
        {isPdf ? "PDF" : (isDocx ? "Document" : "Viewer")}
      </button>
      <button
        className={viewMode === "text" ? activeClass : inactiveClass}
        onClick={() => setViewMode("text")}
        type="button"
      >
        Text
      </button>
      {/* Split view: available for both PDF and DOCX */}
      {(isPdf || isDocx) ? (
        <button
          className={viewMode === "split" ? activeClass : inactiveClass}
          disabled={disabledPdf && !isDocx}
          onClick={() => setViewMode("split")}
          title="Show document and text side-by-side with synchronized scrolling"
          type="button"
        >
          Split
        </button>
      ) : null}
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
  setViewMode,
  viewMode,
  zoom,
}) {
  const [pdfError, setPdfError] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [pagesReady, setPagesReady] = useState(false);
  const isJumpingRef = useRef(false);
  const isSyncScrollingRef = useRef(false);
  const textScrollRef = useRef(null);
  const splitContainerRef = useRef(null);  // outer flex container for drag calc
  const [splitRatio, setSplitRatio] = useState(50); // percent for left panel
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const textDocument = mapTextDocument(selectedDocument);
  const documentType = getDocumentType(selectedDocument);

  // Auto-scale PDF to fit its container area perfectly
  const pdfAreaWidth = viewMode === "split" && containerWidth > 0
    ? Math.round(containerWidth * splitRatio / 100)
    : containerWidth;

  const pageWidth = pdfAreaWidth > 0
    ? Math.max(280, pdfAreaWidth - (viewMode === "split" ? 32 : 80)) * (zoom / 100)
    : Math.round(620 * (zoom / 100));

  const pdfFile = useMemo(() => (pdfBlobUrl ? { url: pdfBlobUrl } : null), [pdfBlobUrl]);

  // Track container width so pageWidth stays accurate after drag / window resize
  useEffect(() => {
    const el = splitContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerWidth(el.offsetWidth);
    });
    ro.observe(el);
    setContainerWidth(el.offsetWidth); // initial value
    return () => ro.disconnect();
  }, [viewMode]); // Re-observe when switching modes

  // ── Draggable split handle ──────────────────────────────────────────────
  const handleSplitDragStart = useCallback((e) => {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;

    setIsDragging(true);

    const onMove = (moveEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const ratio = Math.min(80, Math.max(20, ((clientX - rect.left) / rect.width) * 100));
      setSplitRatio(ratio);
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.document.body.style.cursor = "";
      window.document.body.style.userSelect = "";
    };

    window.document.body.style.cursor = "col-resize";
    window.document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
  }, []);




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
    // In split mode, notify the text panel to scroll to the matching page marker
    if (viewMode === "split" && !isSyncScrollingRef.current) {
      isSyncScrollingRef.current = true;
      window.dispatchEvent(
        new CustomEvent("workspace-sync-scroll", { detail: { page: pageNumber, from: "pdf" } })
      );
      window.setTimeout(() => { isSyncScrollingRef.current = false; }, 600);
    }
  }, [setCurrentPage, viewMode]);

  // Listen for text-side scroll sync → jump PDF to that page
  useEffect(() => {
    if (viewMode !== "split") return;

    function onSyncScroll(event) {
      const { page, from } = event.detail || {};
      if (from === "pdf") return; // avoid loop
      if (!page || isSyncScrollingRef.current) return;

      isSyncScrollingRef.current = true;
      isJumpingRef.current = true;
      setCurrentPage(page);
      window.document.getElementById(`workspace-pdf-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        isJumpingRef.current = false;
        isSyncScrollingRef.current = false;
      }, 600);
    }

    window.addEventListener("workspace-sync-scroll", onSyncScroll);
    return () => window.removeEventListener("workspace-sync-scroll", onSyncScroll);
  }, [viewMode, setCurrentPage]);


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


  useEffect(() => {
    function onHighlightCitation(event) {
      const { documentId, pageNumber, content } = event.detail || {};
      if (documentId && selectedDocument?.id && Number(documentId) !== Number(selectedDocument.id)) return;

      if (documentType === "DOCX" && viewMode !== "text") {
        setViewMode("text");
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent("workspace-highlight-citation", { detail: event.detail }));
        }, 200);
        return;
      }

      if (documentType === "PDF" && viewMode === "pdf") {
        const page = Number(pageNumber);
        if (page) {
          isJumpingRef.current = true;
          setCurrentPage(page);
          const pageEl = window.document.getElementById(`workspace-pdf-page-${page}`);
          pageEl?.scrollIntoView({ behavior: "smooth", block: "start" });
          window.setTimeout(() => {
            isJumpingRef.current = false;
          }, 450);
        }

        window.setTimeout(() => {
          const searchScope = page
            ? window.document.getElementById(`workspace-pdf-page-${page}`)
            : window.document;

          if (!searchScope) return;

          window.document.querySelectorAll(".citation-highlight-active").forEach((el) => {
            el.classList.remove("citation-highlight-active");
          });

          const spans = Array.from(searchScope.querySelectorAll(".react-pdf__Page__textContent span"));
          let matchedSpans = [];

          if (spans.length > 0) {
            let pageText = "";
            const spanRanges = [];
            spans.forEach((span) => {
              const text = span.textContent;
              const start = pageText.length;
              pageText += text + " "; // Add space to separate spans
              spanRanges.push({ span, start, end: start + text.length });
            });

            let normalizedPageText = "";
            const indexMap = [];
            for (let i = 0; i < pageText.length; i++) {
              const char = pageText[i];
              if (!/\s/.test(char)) {
                normalizedPageText += char.toLowerCase();
                indexMap.push(i);
              }
            }

            const normalizedChunk = String(content || "").replace(/\s+/g, "").toLowerCase();
            let originalStartIndex = -1;
            let originalEndIndex = -1;

            if (normalizedChunk) {
              let startIndexInNormalized = normalizedPageText.indexOf(normalizedChunk);
              if (startIndexInNormalized !== -1) {
                originalStartIndex = indexMap[startIndexInNormalized];
                originalEndIndex = indexMap[startIndexInNormalized + normalizedChunk.length - 1];
              } else {
                // Try partial matching if exact match fails
                const startChunk = normalizedChunk.slice(0, 40);
                const endChunk = normalizedChunk.slice(-40);
                const startMatch = startChunk ? normalizedPageText.indexOf(startChunk) : -1;
                const endMatch = endChunk ? normalizedPageText.lastIndexOf(endChunk) : -1;

                if (startMatch !== -1 && endMatch !== -1 && endMatch >= startMatch) {
                  originalStartIndex = indexMap[startMatch];
                  originalEndIndex = indexMap[endMatch + endChunk.length - 1];
                } else if (startMatch !== -1) {
                  originalStartIndex = indexMap[startMatch];
                  let endIdx = startMatch + normalizedChunk.length - 1;
                  if (endIdx >= indexMap.length) endIdx = indexMap.length - 1;
                  originalEndIndex = indexMap[endIdx];
                } else if (endMatch !== -1) {
                  let startIdx = endMatch - (normalizedChunk.length - endChunk.length);
                  if (startIdx < 0) startIdx = 0;
                  originalStartIndex = indexMap[startIdx];
                  originalEndIndex = indexMap[endMatch + endChunk.length - 1];
                }
              }
            }

            if (originalStartIndex !== -1 && originalEndIndex !== -1) {
              matchedSpans = spanRanges
                .filter((range) => range.end > originalStartIndex && range.start <= originalEndIndex)
                .map((range) => range.span);
            }

            // Fallback: block-level word matching if string map fails
            if (matchedSpans.length === 0) {
              const chunkWords = new Set(
                (String(content || "").toLowerCase().match(/[\p{L}\d]+/gu) || []).filter((w) => w.length > 2)
              );
              if (chunkWords.size > 0) {
                const overlappingSpans = spans.filter((span) => {
                  const spanText = span.textContent.toLowerCase().replace(/\s+/g, " ").trim();
                  if (!spanText || spanText.length < 2) return false;
                  const spanWords = (spanText.match(/[\p{L}\d]+/gu) || []).filter((w) => w.length > 2);
                  if (!spanWords.length) return false;
                  const matchCount = spanWords.filter((w) => chunkWords.has(w)).length;
                  return (matchCount / spanWords.length) >= 0.4 || (spanWords.length <= 3 && matchCount >= 1);
                });

                if (overlappingSpans.length > 0) {
                  const firstIndex = spans.indexOf(overlappingSpans[0]);
                  const lastIndex = spans.indexOf(overlappingSpans[overlappingSpans.length - 1]);
                  matchedSpans = spans.slice(firstIndex, lastIndex + 1);
                }
              }
            }
          }

          if (matchedSpans.length) {
            matchedSpans.forEach((span) => span.classList.add("citation-highlight-active"));
            matchedSpans[0].scrollIntoView({ behavior: "smooth", block: "center" });

            let removed = false;
            const removeHighlight = () => {
              if (removed) return;
              removed = true;
              window.document.querySelectorAll(".citation-highlight-active").forEach((el) => {
                el.classList.remove("citation-highlight-active");
              });
            };

            const timer = window.setTimeout(removeHighlight, 8000);

            const handleDocClick = () => {
              removeHighlight();
              window.clearTimeout(timer);
              window.removeEventListener("click", handleDocClick, true);
            };

            window.setTimeout(() => {
              window.addEventListener("click", handleDocClick, { capture: true, once: true });
            }, 50);
          }
        }, 350);
      }
    }

    window.addEventListener("workspace-highlight-citation", onHighlightCitation);
    return () => window.removeEventListener("workspace-highlight-citation", onHighlightCitation);
  }, [selectedDocument?.id, documentType, viewMode, setViewMode, setCurrentPage]);

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

  // ── Split view with draggable resize ─────────────────────────────────
  if (viewMode === "split") {
    const textDoc = mapTextDocument(selectedDocument);

    // DOCX split: left = Office 365 iframe, right = text
    if (documentType === "DOCX") {
      return (
        <div className="flex h-full w-full min-h-0 mx-auto max-w-[1400px]" ref={splitContainerRef}>
          {/* Left: DOCX iframe */}
          <div
            className="min-w-0 overflow-hidden"
            style={{ width: `${splitRatio}%`, pointerEvents: isDragging ? "none" : "auto" }}
          >
            {docxSignedUrl ? (
              <iframe
                title="Document Preview"
                className="h-full w-full border-0 bg-white"
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(docxSignedUrl)}`}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Loading document...
              </div>
            )}
          </div>

          <WorkspaceResizeHandle
            label="Drag to resize panels"
            onMouseDown={handleSplitDragStart}
          />

          {/* Right: Text panel */}
          <div
            className="min-w-0 overflow-y-auto workspace-scrollbar"
            ref={textScrollRef}
            style={{ width: `${100 - splitRatio}%`, pointerEvents: isDragging ? "none" : "auto" }}
          >
            <WorkspaceTextView
              document={textDoc}
              isSplit
              scrollContainerRef={textScrollRef}
            />
          </div>
        </div>
      );
    }

    // PDF split
    return (
      <div className="flex h-full w-full min-h-0 mx-auto max-w-[1400px]" ref={splitContainerRef}>
        {/* Left: PDF panel */}
        <div
          className="min-w-0 overflow-y-auto workspace-scrollbar bg-[#eef0f2]"
          id="workspace-split-pdf"
          style={{ width: `${splitRatio}%`, pointerEvents: isDragging ? "none" : "auto" }}
        >
          {isPdfLoading || !pdfFile ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              <p className="m-0 font-medium">Loading PDF...</p>
            </div>
          ) : (
            <div className="px-4 py-8 pr-6">
              <div className="mx-auto flex w-full flex-col gap-5" style={{ maxWidth: pageWidth + 32 }}>
                <Document
                  file={pdfFile}
                  key={selectedDocument.id}
                  loading={<div className="flex items-center justify-center py-24 text-sm text-slate-500">Reading PDF...</div>}
                  onLoadError={() => setPdfError(true)}
                  onLoadSuccess={handleLoadSuccess}
                  options={PDF_DOCUMENT_OPTIONS}
                >
                  {pagesReady && numPages > 0
                    ? Array.from({ length: numPages }, (_, index) => (
                        <WorkspaceLazyPdfPage
                          key={`pdf-page-split-${index + 1}`}
                          onPageVisible={handlePageVisible}
                          pageNumber={index + 1}
                          width={pageWidth}
                        />
                      ))
                    : null}
                </Document>
              </div>
            </div>
          )}
        </div>

        {/* Draggable divider */}
        <WorkspaceResizeHandle
          label="Drag to resize panels"
          onMouseDown={handleSplitDragStart}
        />

        {/* Right: Text panel */}
        <div
          className="min-w-0 overflow-y-auto workspace-scrollbar"
          ref={textScrollRef}
          style={{ width: `${100 - splitRatio}%`, pointerEvents: isDragging ? "none" : "auto" }}
        >
          <WorkspaceTextView
            document={textDoc}
            isSplit
            scrollContainerRef={textScrollRef}
          />
        </div>
      </div>
    );
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
    <div className="workspace-selectable min-h-full bg-[#eef0f2] px-4 py-8 pr-6 sm:px-8 sm:pr-10" ref={splitContainerRef}>
      <div className="mx-auto flex w-full flex-col gap-5" style={{ maxWidth: pageWidth > 0 ? pageWidth + 32 : 680 }}>
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
  const [notebookNotes, setNotebookNotes] = useState([]);
  const documentType = getDocumentType(selectedDocument);

  useEffect(() => {
    setNotebookNotes([]);
    setShowNotebookPanel(false);
    setShowProperties(false);
    if (!selectedDocument?.id) return undefined;

    let isMounted = true;
    loadNotebookNotes(selectedDocument.id)
      .then((items) => {
        if (isMounted) setNotebookNotes(items);
      })
      .catch(() => {
        if (isMounted) setNotebookNotes([]);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDocument?.id]);
  const showPdfControls = (viewMode === "pdf" || viewMode === "split") && documentType === "PDF" && selectedDocument;
  const status = processResult?.status || selectedDocument?.extraction_status || selectedDocument?.status;

  const handleDeleteNote = useCallback(async (noteId) => {
    if (!selectedDocument?.id) return;
    await removeNotebookNote(selectedDocument.id, noteId);
    setNotebookNotes((current) => current.filter((n) => n.id !== noteId));
  }, [selectedDocument?.id]);

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
              <div className="relative">
                <button
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                    showNotebookPanel
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  data-notes-trigger="true"
                  onClick={() => setShowNotebookPanel((v) => !v)}
                  type="button"
                >
                  Notes{notebookNotes.length > 0 ? ` (${notebookNotes.length})` : ""}
                </button>
                {showNotebookPanel ? (
                  <WorkspaceNotesPopover 
                    notes={notebookNotes} 
                    documentId={selectedDocument.id}
                    onClose={() => setShowNotebookPanel(false)}
                    onDelete={handleDeleteNote}
                  />
                ) : null}
              </div>
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


      <div
        className={`workspace-selectable relative min-h-0 flex-1 bg-[#eef0f2] ${viewMode === "split" ? "overflow-hidden flex" : "workspace-scrollbar overflow-y-auto"}`}
        id="workspace-viewer-area"
      >
        <WorkspaceNotebook
          docId={selectedDocument?.id}
          onNotesChange={setNotebookNotes}
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
            setViewMode={setViewMode}
            viewMode={viewMode}
            zoom={zoom}
          />
        </WorkspaceNotebook>
      </div>
    </section>
  );
}
