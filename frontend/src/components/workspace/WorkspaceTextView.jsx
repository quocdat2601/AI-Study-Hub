import React from "react";
import { getHighlightRects } from "../../utils/workspaceNotebookAnchor.js";
import WorkspaceNotebookHighlightRects from "./WorkspaceNotebookHighlightRects.jsx";
import { useWorkspaceNotebook } from "./workspaceNotebookContext.js";

function EmptyTextState({ document }) {
  const status = document?.extractionStatus;
  const error = document?.extractionError;

  if (status === "pending") {
    return (
      <>
        <p className="m-0 mb-2 text-base font-semibold text-slate-800">Đang trích xuất text...</p>
        <p className="m-0 text-sm leading-relaxed text-slate-500">
          Hệ thống đang đọc nội dung từ file. Chuyển sang <strong>PDF</strong> để đọc ngay.
        </p>
      </>
    );
  }

  if (status === "failed") {
    return (
      <>
        <p className="m-0 mb-2 text-base font-semibold text-slate-800">Không có text</p>
        <p className="m-0 text-sm leading-relaxed text-slate-500">
          {error || "Không đọc được text từ file này."} Bạn vẫn đọc bản PDF ở tab <strong>PDF</strong>.
        </p>
      </>
    );
  }

  if (status === "empty") {
    return (
      <>
        <p className="m-0 mb-2 text-base font-semibold text-amber-800">PDF scan (ảnh chụp)</p>
        <p className="m-0 text-sm leading-relaxed text-slate-600">
          File <strong>{document?.title}</strong> không có lớp chữ chọn được.
          Đọc đầy đủ nội dung ở tab <strong>PDF</strong>. AI chat cần PDF có text gõ sẵn.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="m-0 mb-2 text-base font-semibold text-slate-800">Chưa có text</p>
      <p className="m-0 text-sm leading-relaxed text-slate-500">
        Chuyển sang <strong>PDF</strong> để đọc file gốc.
      </p>
    </>
  );
}

export default function WorkspaceTextView({ document }) {
  const { notes, draft, onHighlightClick } = useWorkspaceNotebook();
  const articleRef = React.useRef(null);
  const textNotes = notes.filter((note) => note.viewMode === "text");
  const showDraft = draft?.anchor?.scope === "container";
  const paragraphs = String(document?.extractedText || "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  React.useEffect(() => {
    function onHighlightCitation(event) {
      const { documentId, content, startChar, endChar } = event.detail || {};
      if (documentId && Number(documentId) !== Number(document?.id)) return;

      const article = articleRef.current;
      if (!article || !content) return;

      const pElements = Array.from(article.querySelectorAll("[data-workspace-note-paragraph]"));
      if (!pElements.length) return;

      let matchingElements = [];

      // 1. Primary Strategy: Use character offsets if available
      if (startChar != null && endChar != null && Number(endChar) > Number(startChar)) {
        let cumulative = 0;
        matchingElements = pElements.filter((el) => {
          const textLen = el.textContent.length;
          const pStart = cumulative;
          const pEnd = cumulative + textLen;
          cumulative += textLen + 1;
          return pEnd >= Number(startChar) && pStart <= Number(endChar);
        });
      }

      // 2. Secondary Strategy: Token/Word overlap matching
      if (!matchingElements.length) {
        const chunkWords = new Set(
          (String(content).toLowerCase().match(/[\p{L}\d]+/gu) || []).filter((w) => w.length > 2)
        );

        if (chunkWords.size > 0) {
          matchingElements = pElements.filter((el) => {
            const pWords = (el.textContent.toLowerCase().match(/[\p{L}\d]+/gu) || []).filter((w) => w.length > 2);
            if (!pWords.length) return false;
            const matchCount = pWords.filter((w) => chunkWords.has(w)).length;
            return (matchCount / pWords.length) >= 0.4 || (pWords.length <= 4 && matchCount >= 1);
          });
        }
      }

      // 3. Fallback: Snippet matching
      if (!matchingElements.length) {
        const cleanSnippet = String(content).slice(0, 35).toLowerCase().replace(/\s+/g, " ").trim();
        if (cleanSnippet) {
          const found = pElements.find((el) => el.textContent.toLowerCase().replace(/\s+/g, " ").includes(cleanSnippet));
          if (found) matchingElements = [found];
        }
      }

      if (!matchingElements.length) return;

      // Clear any previous highlights across the document immediately
      window.document.querySelectorAll(".citation-highlight-active").forEach((el) => {
        el.classList.remove("citation-highlight-active");
      });

      // Highlight ALL matching paragraph elements in the chunk
      matchingElements.forEach((el) => el.classList.add("citation-highlight-active"));

      // Scroll the first paragraph of the chunk into view
      matchingElements[0].scrollIntoView({ behavior: "smooth", block: "center" });

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

    window.addEventListener("workspace-highlight-citation", onHighlightCitation);
    return () => window.removeEventListener("workspace-highlight-citation", onHighlightCitation);
  }, [document?.id]);

  if (!paragraphs.length) {
    return (
      <div className="workspace-selectable flex min-h-full items-start justify-center px-5 py-8">
        <div className="w-full max-w-[620px] select-text rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <EmptyTextState document={document} />
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-selectable min-h-full px-4 py-6 pr-8 sm:px-6 sm:pr-12">
      <article
        className="relative mx-auto w-full max-w-[620px] select-text rounded-xl border border-slate-200 bg-white px-8 py-10 shadow-sm"
        data-workspace-note-article="true"
        ref={articleRef}
      >
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
          Nội dung text
        </p>
        <h1 className="mb-6 text-xl font-bold leading-snug text-slate-900">{document.title}</h1>
        {paragraphs.map((paragraph, index) => (
          <p
            className="mb-3 text-[15px] leading-[1.75] text-slate-700"
            data-workspace-note-paragraph={index}
            key={index}
          >
            {paragraph}
          </p>
        ))}

        {textNotes.map((note) => (
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
      </article>
    </div>
  );
}
