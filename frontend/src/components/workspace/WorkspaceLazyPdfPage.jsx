import React, { memo, useEffect, useRef, useState } from "react";
import { Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";

function WorkspaceLazyPdfPage({ pageNumber, width, onPageVisible }) {
  const containerRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(pageNumber <= 2);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || shouldRender) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
        }
      },
      { rootMargin: "500px 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldRender]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          onPageVisible?.(pageNumber);
        }
      },
      { threshold: [0.35, 0.55, 0.75] }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [pageNumber, onPageVisible]);

  const placeholderHeight = Math.round(width * 1.35);

  return (
    <div
      className="overflow-hidden bg-white shadow-[0_6px_24px_rgba(15,23,42,0.1)]"
      data-page={pageNumber}
      id={`workspace-pdf-page-${pageNumber}`}
      ref={containerRef}
    >
      {shouldRender ? (
        <Page
          loading={
            <div
              className="flex items-center justify-center bg-slate-50 text-sm text-slate-400"
              style={{ height: placeholderHeight }}
            >
              Page {pageNumber}
            </div>
          }
          pageNumber={pageNumber}
          renderAnnotationLayer={false}
          renderTextLayer
          width={width}
        />
      ) : (
        <div
          className="flex items-center justify-center bg-slate-50 text-sm text-slate-400"
          style={{ height: placeholderHeight }}
        >
          Page {pageNumber}
        </div>
      )}
    </div>
  );
}

export default memo(WorkspaceLazyPdfPage);
