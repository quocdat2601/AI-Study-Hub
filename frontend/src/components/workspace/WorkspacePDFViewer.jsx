import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document } from "react-pdf";
import "../../lib/pdfWorker.js";
import { PDF_DOCUMENT_OPTIONS } from "../../lib/pdfWorker.js";
import { useWorkspace } from "../../contexts/WorkspaceContext.jsx";
import WorkspaceLazyPdfPage from "./WorkspaceLazyPdfPage.jsx";
import WorkspaceTextView from "./WorkspaceTextView.jsx";
import WorkspaceDocxViewer from "./WorkspaceDocxViewer.jsx";

export default function WorkspacePDFViewer() {
  const {
    selectedDocument,
    pdfBlobUrl,
    pdfUrl,
    isPdfLoading,
    pdfLoadError,
    setCurrentPage,
    setTotalPages,
    zoom,
    viewMode,
    loadDocument,
    selectedDocId,
  } = useWorkspace();

  const [pdfError, setPdfError] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [pagesReady, setPagesReady] = useState(false);
  const isJumpingRef = useRef(false);
  const pageWidth = Math.round(620 * (zoom / 100));

  const pdfFile = useMemo(() => {
    if (!pdfBlobUrl) return null;
    return { url: pdfBlobUrl };
  }, [pdfBlobUrl]);

  useEffect(() => {
    setPdfError(false);
    setNumPages(0);
    setPagesReady(false);
    setCurrentPage(1);
  }, [pdfBlobUrl, setCurrentPage]);

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

      const element = window.document.getElementById(`workspace-pdf-page-${page}`);
      element?.scrollIntoView({ behavior: "smooth", block: "start" });

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

      const docMime = selectedDocument?.cloud_files?.mime_type || selectedDocument?.mime_type || "";
      const docTitle = selectedDocument?.title || selectedDocument?.name || "";
      const isDocxDoc = selectedDocument?.type === "DOCX" || docMime.includes("word") || docMime.includes("msword") || docTitle.toLowerCase().endsWith(".docx") || docTitle.toLowerCase().endsWith(".doc");

      if (isDocxDoc && viewMode !== "text") {
        setViewMode("text");
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent("workspace-highlight-citation", { detail: event.detail }));
        }, 200);
        return;
      }

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

        const spans = Array.from(searchScope.querySelectorAll(".react-pdf__Page__textContent span"));
        let matchedSpans = [];

        if (spans.length > 0) {
          let pageText = "";
          const spanRanges = [];
          spans.forEach((span) => {
            const text = span.textContent;
            const start = pageText.length;
            pageText += text + " ";
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
          window.document.querySelectorAll(".citation-highlight-active").forEach((el) => {
            el.classList.remove("citation-highlight-active");
          });

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

    window.addEventListener("workspace-highlight-citation", onHighlightCitation);
    return () => window.removeEventListener("workspace-highlight-citation", onHighlightCitation);
  }, [selectedDocument, setViewMode, viewMode, setCurrentPage]);

  if (!selectedDocument) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
        Chọn tài liệu từ sidebar.
      </div>
    );
  }

  const docMime = selectedDocument?.cloud_files?.mime_type || selectedDocument?.mime_type || "";
  const docTitle = selectedDocument?.title || selectedDocument?.name || "";
  const isPdf = selectedDocument?.type === "PDF" || docMime.includes("pdf") || docTitle.toLowerCase().endsWith(".pdf");
  const isDocx = selectedDocument?.type === "DOCX" || docMime.includes("word") || docMime.includes("msword") || docTitle.toLowerCase().endsWith(".docx") || docTitle.toLowerCase().endsWith(".doc");

  if (viewMode === "text") {
    return <WorkspaceTextView document={selectedDocument} />;
  }

  if (isDocx && pdfUrl) {
    return (
      <iframe
        title="Document Preview"
        className="w-full border-0 bg-white"
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(pdfUrl)}`}
        style={{ minHeight: "calc(100vh - 165px)" }}
      />
    );
  }

  if (!isPdf) {
    return <WorkspaceTextView document={selectedDocument} />;
  }

  if (isPdfLoading || !pdfFile) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
        <p>Đang tải file PDF...</p>
        <p className="text-xs text-slate-400">File lớn có thể mất vài phút.</p>
      </div>
    );
  }

  if (pdfLoadError || pdfError) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-red-600">
        <p>{pdfLoadError || "Không mở được PDF. Thử tải lại hoặc chuyển sang Text view."}</p>
        <button
          className="cursor-pointer rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
          onClick={() => selectedDocId && loadDocument(selectedDocId)}
          type="button"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="workspace-selectable min-h-full bg-[#eef0f2] px-4 py-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5">
        <Document
          error={
            <div className="rounded-sm bg-white p-10 text-center text-sm text-red-600 shadow-md">
              Không hiển thị được PDF.
            </div>
          }
          file={pdfFile}
          key={selectedDocId}
          loading={
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-sm text-slate-500">
              <p>Đang phân tích PDF...</p>
              <p className="text-xs text-slate-400">Đang đọc cấu trúc file, vui lòng đợi.</p>
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
