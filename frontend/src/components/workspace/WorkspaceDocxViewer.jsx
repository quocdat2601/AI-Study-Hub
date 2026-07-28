import React, { useEffect, useRef } from "react";

/**
 * Native DOM-based DOCX Viewer component.
 * Renders document paragraphs directly in the React DOM with structured attributes
 * for index-based navigation, smooth scrolling, and dynamic citation passage highlighting.
 */
export default function WorkspaceDocxViewer({ document }) {
  const containerRef = useRef(null);

  const paragraphs = String(document?.extractedText || "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  useEffect(() => {
    function onHighlightCitation(event) {
      const { documentId, chunkIndex, content } = event.detail || {};
      if (documentId && Number(documentId) !== Number(document?.id)) return;

      const container = containerRef.current;
      if (!container) return;

      // 1. Try finding by chunkIndex/paragraph index match
      let targetElement = null;
      if (chunkIndex != null) {
        targetElement = container.querySelector(`[data-docx-paragraph="${chunkIndex}"]`);
      }

      // 2. Fallback to fuzzy text search if paragraph index didn't match or wasn't provided
      if (!targetElement && content) {
        const cleanSnippet = String(content).slice(0, 40).toLowerCase().trim();
        const pElements = Array.from(container.querySelectorAll("[data-docx-paragraph]"));
        targetElement = pElements.find((el) => el.textContent.toLowerCase().includes(cleanSnippet));
      }

      if (!targetElement) return;

      // Scroll into view
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });

      // Apply temporary visual highlight
      targetElement.classList.add("citation-highlight-active");

      const removeHighlight = () => {
        targetElement?.classList.remove("citation-highlight-active");
      };

      const timer = window.setTimeout(removeHighlight, 3500);

      const handleDocClick = () => {
        removeHighlight();
        window.clearTimeout(timer);
        window.removeEventListener("click", handleDocClick);
      };

      window.setTimeout(() => {
        window.addEventListener("click", handleDocClick, { once: true });
      }, 100);
    }

    window.addEventListener("workspace-highlight-citation", onHighlightCitation);
    return () => window.removeEventListener("workspace-highlight-citation", onHighlightCitation);
  }, [document?.id]);

  if (!paragraphs.length) {
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-center text-sm text-slate-500">
        Không tìm thấy nội dung văn bản cho file DOCX này.
      </div>
    );
  }

  return (
    <div className="workspace-selectable min-h-full px-4 py-6 pr-8 sm:px-6 sm:pr-12" ref={containerRef}>
      <article
        className="relative mx-auto w-full max-w-[680px] select-text rounded-xl border border-slate-200 bg-white px-8 py-10 shadow-sm"
        data-workspace-note-article="true"
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
            DOCX Document View
          </span>
          <span className="text-xs text-slate-400">
            {paragraphs.length} paragraphs
          </span>
        </div>

        <h1 className="mb-6 text-xl font-bold leading-snug text-slate-900">{document?.title}</h1>

        <div className="space-y-4">
          {paragraphs.map((paragraph, index) => (
            <p
              className="rounded-lg p-2 text-[15px] leading-[1.75] text-slate-700 transition-all duration-300"
              data-docx-paragraph={index}
              key={index}
            >
              {paragraph}
            </p>
          ))}
        </div>
      </article>
    </div>
  );
}
