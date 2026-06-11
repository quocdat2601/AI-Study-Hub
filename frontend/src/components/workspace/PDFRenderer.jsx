import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "../../lib/pdfWorker.js";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

function LazyPage({ pageNumber, width, scrollRoot, onVisible }) {
  const wrapperRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(pageNumber <= 2);
  const placeholderHeight = Math.round(width * 1.414);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldRender(true);
            onVisible?.(pageNumber);
          }
        });
      },
      { root: scrollRoot, rootMargin: "240px 0px", threshold: 0.15 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [pageNumber, scrollRoot, onVisible]);

  return (
    <div
      className="mb-4 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)] last:mb-8"
      data-page={pageNumber}
      ref={wrapperRef}
      style={{ minHeight: shouldRender ? undefined : placeholderHeight }}
    >
      {shouldRender ? (
        <Page
          pageNumber={pageNumber}
          renderAnnotationLayer
          renderTextLayer
          width={width}
        />
      ) : (
        <div className="flex items-center justify-center text-xs text-slate-400" style={{ height: placeholderHeight }}>
          Page {pageNumber}
        </div>
      )}
    </div>
  );
}

/**
 * Custom PDF viewer — cuộn panel giữa để đọc các trang (lazy load từng trang).
 */
export default function PDFRenderer({
  pdfBytes,
  pageWidth,
  zoom,
  scrollRoot,
  onLoadSuccess,
  onError,
  onVisiblePageChange,
}) {
  const [totalPages, setTotalPages] = useState(0);
  const renderWidth = Math.max(360, Math.round((pageWidth * zoom) / 100));

  const fileSource = useMemo(() => {
    if (!pdfBytes) return null;
    return { data: pdfBytes };
  }, [pdfBytes]);

  useEffect(() => {
    setTotalPages(0);
  }, [pdfBytes]);

  if (!fileSource) {
    return null;
  }

  return (
    <Document
      error={
        <p className="py-16 text-center text-sm text-red-500">Failed to load PDF file.</p>
      }
      file={fileSource}
      loading={
        <p className="py-16 text-center text-sm text-slate-500">Rendering document...</p>
      }
      onLoadError={(error) => onError?.(error?.message || "Failed to load PDF file.")}
      onLoadSuccess={({ numPages }) => {
        setTotalPages(numPages);
        onLoadSuccess?.(numPages);
        onVisiblePageChange?.(1);
      }}
    >
      {totalPages > 0
        ? Array.from({ length: totalPages }, (_, index) => {
            const pageNumber = index + 1;
            return (
              <LazyPage
                key={pageNumber}
                onVisible={onVisiblePageChange}
                pageNumber={pageNumber}
                scrollRoot={scrollRoot}
                width={renderWidth}
              />
            );
          })
        : null}
    </Document>
  );
}
