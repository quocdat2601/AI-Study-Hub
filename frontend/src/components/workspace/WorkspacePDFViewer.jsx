import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document } from "react-pdf";
import "../../lib/pdfWorker.js";
import { PDF_DOCUMENT_OPTIONS } from "../../lib/pdfWorker.js";
import { useWorkspace } from "../../contexts/WorkspaceContext.jsx";
import WorkspaceLazyPdfPage from "./WorkspaceLazyPdfPage.jsx";
import WorkspaceTextView from "./WorkspaceTextView.jsx";

export default function WorkspacePDFViewer() {
  const {
    selectedDocument,
    pdfBlobUrl,
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

  if (!selectedDocument) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
        Chọn tài liệu từ sidebar.
      </div>
    );
  }

  if (viewMode === "text") {
    return <WorkspaceTextView document={selectedDocument} />;
  }

  if (selectedDocument.type !== "PDF") {
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
