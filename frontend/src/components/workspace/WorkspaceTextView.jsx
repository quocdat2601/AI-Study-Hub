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

/** Styled page-break divider — matches PDF page boundaries exactly */
function PageDivider({ pageNumber }) {
  return (
    <div
      className="relative my-6 flex items-center gap-3 select-none"
      data-text-page={pageNumber}
    >
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 shadow-sm">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-slate-300">
          <rect x="1" y="1" width="3.5" height="4" rx="0.5" fill="currentColor" />
          <rect x="5.5" y="1" width="3.5" height="4" rx="0.5" fill="currentColor" />
          <rect x="1" y="6" width="8" height="3" rx="0.5" fill="currentColor" opacity="0.4" />
        </svg>
        Page {pageNumber}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    </div>
  );
}

/**
 * Build render items by working directly from the RAW full text and
 * pageBoundaries character offsets — avoids the cumulative offset drift
 * that occurred when paragraphs were split with /\n+/ (which swallows the
 * multi-char \n\n page separators).
 *
 * Strategy:
 *   1. For each page boundary [startChar, endChar], slice the raw text to
 *      get that page's exact text.
 *   2. Split each page slice into paragraphs and tag them with their page.
 *   3. Emit a PageDivider before each page > 1.
 *
 * Fallback (no pageBoundaries): treat entire text as one block (original
 * behaviour, no dividers).
 *
 * @param {string} rawText           - document.extractedText (full string)
 * @param {{ pageNumber: number, startChar: number, endChar: number }[]} pageBoundaries
 */
function buildRenderItems(rawText, pageBoundaries) {
  const items = [];
  let paraIndex = 0;

  if (!pageBoundaries || pageBoundaries.length === 0) {
    // No page data — just render all paragraphs without dividers
    const paras = rawText.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    paras.forEach((text) => {
      items.push({ type: "paragraph", text, index: paraIndex++ });
    });
    return items;
  }

  const sorted = [...pageBoundaries].sort((a, b) => a.pageNumber - b.pageNumber);

  sorted.forEach((boundary, bIdx) => {
    const pageText = rawText.slice(boundary.startChar, boundary.endChar);
    const paras = pageText.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    if (!paras.length) return;

    // Insert divider before every page except the very first
    if (bIdx > 0) {
      items.push({ type: "divider", pageNumber: boundary.pageNumber });
    }

    paras.forEach((text) => {
      items.push({ type: "paragraph", text, index: paraIndex++, page: boundary.pageNumber });
    });
  });

  return items;
}

export default function WorkspaceTextView({ document, scrollContainerRef, isSplit = false }) {
  const { notes, draft, onHighlightClick } = useWorkspaceNotebook();
  const articleRef = React.useRef(null);
  const textNotes = notes.filter((note) => note.viewMode === "text");
  const showDraft = draft?.anchor?.scope === "container";

  const rawText = String(document?.extractedText || "");
  // Keep paragraphs for legacy note highlight anchor matching
  const paragraphs = rawText.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  const pageBoundaries = React.useMemo(
    () => document?.extractionMetadata?.pageBoundaries || [],
    [document?.id, document?.extractionMetadata]
  );

  const renderItems = React.useMemo(
    () => buildRenderItems(rawText, pageBoundaries),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [document?.id, rawText, pageBoundaries]
  );

  // ── Citation highlight listener ─────────────────────────────────────────
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

      window.document.querySelectorAll(".citation-highlight-active").forEach((el) => {
        el.classList.remove("citation-highlight-active");
      });

      matchingElements.forEach((el) => el.classList.add("citation-highlight-active"));
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
      window.setTimeout(() => {
        window.addEventListener("click", () => {
          removeHighlight();
          window.clearTimeout(timer);
        }, { capture: true, once: true });
      }, 50);
    }

    window.addEventListener("workspace-highlight-citation", onHighlightCitation);
    return () => window.removeEventListener("workspace-highlight-citation", onHighlightCitation);
  }, [document?.id]);

  // ── Split-view scroll sync: PDF → Text ─────────────────────────────────
  React.useEffect(() => {
    if (!isSplit || !pageBoundaries.length) return;

    function onSyncScroll(event) {
      const { page, from } = event.detail || {};
      if (from === "text") return;
      if (!page) return;
      const divider = window.document.querySelector(`[data-text-page="${page}"]`);
      if (divider) {
        divider.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    window.addEventListener("workspace-sync-scroll", onSyncScroll);
    return () => window.removeEventListener("workspace-sync-scroll", onSyncScroll);
  }, [isSplit, pageBoundaries]);

  // ── Split-view scroll sync: Text → PDF (IntersectionObserver) ──────────
  React.useEffect(() => {
    if (!isSplit || !pageBoundaries.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          const page = Number(visible[0].target.getAttribute("data-text-page"));
          if (page) {
            window.dispatchEvent(
              new CustomEvent("workspace-sync-scroll", { detail: { page, from: "text" } })
            );
          }
        }
      },
      {
        root: scrollContainerRef?.current || null,
        rootMargin: "0px 0px -80% 0px",
        threshold: 0,
      }
    );

    const article = articleRef.current;
    if (!article) return;
    article.querySelectorAll("[data-text-page]").forEach((d) => observer.observe(d));

    return () => observer.disconnect();
  }, [isSplit, pageBoundaries, scrollContainerRef]);

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

        {renderItems.map((item, _i) => {
          if (item.type === "divider") {
            return <PageDivider key={`divider-p${item.pageNumber}`} pageNumber={item.pageNumber} />;
          }
          return (
            <p
              className="mb-3 text-[15px] leading-[1.75] text-slate-700"
              data-workspace-note-paragraph={item.index}
              key={`para-${item.index}`}
            >
              {item.text}
            </p>
          );
        })}

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
