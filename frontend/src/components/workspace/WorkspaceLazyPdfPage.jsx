import React, { memo, useEffect, useRef, useState } from "react";
import { Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { getHighlightRects } from "../../utils/workspaceNotebookAnchor.js";
import WorkspaceNotebookHighlightRects from "./WorkspaceNotebookHighlightRects.jsx";
import { useWorkspaceNotebook } from "./workspaceNotebookContext.js";

function WorkspaceLazyPdfPage({ pageNumber, width, onPageVisible }) {
  const containerRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(pageNumber <= 2);
  const { notes, draft, onHighlightClick } = useWorkspaceNotebook();
  const pageNotes = notes.filter((note) => note.viewMode === "pdf" && Number(note.pageNumber) === pageNumber);
  const showDraft = draft?.anchor?.scope === "page" && Number(draft.pageNumber) === pageNumber;

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
      className="bg-white shadow-[0_6px_24px_rgba(15,23,42,0.1)]"
      data-page={pageNumber}
      id={`workspace-pdf-page-${pageNumber}`}
      ref={containerRef}
    >
      <div className="relative inline-block leading-none" data-workspace-pdf-page={pageNumber}>
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
            style={{ height: placeholderHeight, width }}
          >
            Page {pageNumber}
          </div>
        )}

        {(pageNotes.length > 0 || showDraft) ? (
          <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
            {pageNotes.map((note) => (
              getHighlightRects(note.anchor).length ? (
                <WorkspaceNotebookHighlightRects
                  anchor={note.anchor}
                  color={note.color}
                  interactive
                  key={note.id}
                  noteId={note.id}
                  onHighlightClick={() => onHighlightClick(note)}
                />
              ) : null
            ))}

            {showDraft ? <WorkspaceNotebookHighlightRects anchor={draft.anchor} color={draft.color} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default memo(WorkspaceLazyPdfPage);
