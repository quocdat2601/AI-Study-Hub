import React, { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { getDocumentSignedUrl } from "../../services/documentApi.js";
import PDFRenderer from "./PDFRenderer.jsx";
import ViewerToolbar from "./ViewerToolbar.jsx";

export default function DocumentViewer({
  selectedDocument,
  pdfBytes,
  pdfError,
  isLoadingPdf,
  currentPage,
  totalPages,
  zoom,
  changeZoom,
  goToPage,
  setTotalPages,
  setPdfError,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef(null);
  const [scrollElement, setScrollElement] = useState(null);
  const [pageWidth, setPageWidth] = useState(760);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    function updateWidth() {
      const nextWidth = element.clientWidth - 32;
      setPageWidth(Math.max(360, nextWidth));
    }

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [pdfBytes, isFullscreen]);

  async function handleDownload() {
    if (!selectedDocument) return;
    try {
      const { signedUrl } = await getDocumentSignedUrl(selectedDocument.id);
      const link = window.document.createElement("a");
      link.href = signedUrl;
      link.download = selectedDocument.title || "document";
      link.click();
    } catch {
      // Ignore download errors.
    }
  }

  function scrollToPage(page) {
    const target = scrollRef.current?.querySelector(`[data-page="${page}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    goToPage(page);
  }

  return (
    <section
      className={`relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-viewer)] ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      <ViewerToolbar
        currentPage={currentPage}
        onDownload={handleDownload}
        onPageChange={scrollToPage}
        onToggleFullscreen={() => setIsFullscreen((value) => !value)}
        onZoomChange={changeZoom}
        selectedDocument={selectedDocument}
        totalPages={totalPages}
        zoom={zoom}
      />

      <div
        className="min-h-0 flex-1 overflow-y-auto workspace-scroll px-4 py-4"
        ref={(node) => {
          scrollRef.current = node;
          setScrollElement(node);
        }}
      >
        {!selectedDocument ? (
          <div className="flex min-h-[400px] items-center justify-center text-sm text-[var(--text-muted)]">
            Select a document to start studying.
          </div>
        ) : null}

        {selectedDocument && isLoadingPdf ? (
          <div className="flex min-h-[400px] items-center justify-center text-sm text-[var(--text-muted)]">
            Loading preview...
          </div>
        ) : null}

        {selectedDocument && pdfError ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-8 text-center">
              <FileText className="mx-auto mb-3 text-[var(--text-muted)]" size={32} />
              <p className="m-0 text-sm text-[var(--text-secondary)]">{pdfError}</p>
            </div>
          </div>
        ) : null}

        {selectedDocument && pdfBytes && !pdfError ? (
          <PDFRenderer
            onError={(message) => setPdfError?.(message)}
            onLoadSuccess={(numPages) => {
              setTotalPages(numPages);
            }}
            onVisiblePageChange={goToPage}
            pageWidth={pageWidth}
            pdfBytes={pdfBytes}
            scrollRoot={scrollElement}
            zoom={zoom}
          />
        ) : null}
      </div>
    </section>
  );
}
