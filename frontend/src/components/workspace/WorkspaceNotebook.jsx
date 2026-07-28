import React, { useCallback, useEffect, useRef, useState } from "react";
import WorkspaceNotebookPanel from "./WorkspaceNotebookPanel.jsx";
import WorkspaceNotebookPopup from "./WorkspaceNotebookPopup.jsx";
import WorkspaceNotebookViewPopup from "./WorkspaceNotebookViewPopup.jsx";
import { WorkspaceNotebookContext } from "./workspaceNotebookContext.js";
import {
  addNotebookNote,
  editNotebookNote,
  loadNotebookNotes,
  removeNotebookNote,
} from "../../utils/workspaceNotebook.js";
import { DEFAULT_NOTE_COLOR } from "../../utils/workspaceNotebookColors.js";
import {
  buildAnchorFromRange,
  getDraftCardPosition,
  getNoteCardPosition,
} from "../../utils/workspaceNotebookAnchor.js";

function jumpToPdfPage(pageNumber) {
  if (!pageNumber) return;
  window.dispatchEvent(new CustomEvent("workspace-jump-to-page", { detail: { page: pageNumber } }));
}

function jumpToTextParagraph(paragraphIndex) {
  if (paragraphIndex == null) return;
  const element = window.document.querySelector(`[data-workspace-note-paragraph="${paragraphIndex}"]`);
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
}

const NOTE_CARD_WIDTH = 300;

function getSelectionMeta(container, selection) {
  if (!selection?.rangeCount || !container) return null;

  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();
  if (!text) return null;

  const anchorNode = range.commonAncestorContainer;
  const element = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
  if (!element || !container.contains(element)) return null;
  if (element.closest("[data-workspace-notebook-panel], [data-workspace-notebook-popup], [data-workspace-note-highlight]")) {
    return null;
  }

  const pageElement = element.closest("[data-page]");
  const paragraphElement = element.closest("[data-workspace-note-paragraph]");
  const anchor = buildAnchorFromRange(range, container);
  if (!anchor.rects.length) return null;

  const card = getDraftCardPosition(anchor, NOTE_CARD_WIDTH, container.clientWidth);

  return {
    selectedText: text,
    cardTop: card.cardTop,
    cardLeft: card.cardLeft,
    anchor,
    pageNumber: pageElement ? Number(pageElement.dataset.page) : null,
    paragraphIndex: paragraphElement ? Number(paragraphElement.dataset.workspaceNoteParagraph) : null,
  };
}

export default function WorkspaceNotebook({
  children,
  docId,
  viewMode,
  showPanel,
  onTogglePanel,
  onNotesChange,
}) {
  const containerRef = useRef(null);
  const draftRef = useRef(null);
  const isSavingRef = useRef(false);
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState(null);
  const [draftColor, setDraftColor] = useState(DEFAULT_NOTE_COLOR);
  const [activeNote, setActiveNote] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [containerWidth, setContainerWidth] = useState(680);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  const [pendingSelection, setPendingSelection] = useState(null);

  const refreshNotes = useCallback(async () => {
    if (!docId) {
      setNotes([]);
      onNotesChange?.([]);
      return;
    }

    try {
      const nextNotes = await loadNotebookNotes(docId);
      setNotes(nextNotes);
      onNotesChange?.(nextNotes);
    } catch {
      setNotes([]);
      onNotesChange?.([]);
    }
  }, [docId, onNotesChange]);

  useEffect(() => {
    refreshNotes();
    setDraft(null);
    setPendingSelection(null);
    setDraftColor(DEFAULT_NOTE_COLOR);
    setActiveNote(null);
  }, [docId, refreshNotes]);

  const clearBrowserSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleHighlightClick = useCallback((note) => {
    setActiveNote(note);
    setDraft(null);
    setPendingSelection(null);
    clearBrowserSelection();
  }, [clearBrowserSelection]);

  const handleMouseUp = useCallback((event) => {
    if (!docId || isSavingRef.current || draftRef.current) return;
    if (event.target.closest("[data-workspace-notebook-popup], [data-workspace-notebook-panel], [data-workspace-note-action], [data-notes-popover]")) {
      return;
    }

    window.setTimeout(() => {
      if (isSavingRef.current || draftRef.current) return;

      const meta = getSelectionMeta(containerRef.current, window.getSelection());
      if (meta) {
        setPendingSelection(meta);
      } else {
        setPendingSelection(null);
      }
    }, 10);
  }, [docId]);

  const handleCancel = useCallback(() => {
    setDraft(null);
    setDraftColor(DEFAULT_NOTE_COLOR);
    clearBrowserSelection();
  }, [clearBrowserSelection]);

  const handleSave = useCallback(
    async (content, color) => {
      if (!docId || !draft || isSaving) return;

      setIsSaving(true);
      try {
        const saved = await addNotebookNote(docId, {
          viewMode,
          selectedText: draft.selectedText,
          content,
          pageNumber: draft.pageNumber,
          paragraphIndex: draft.paragraphIndex,
          anchor: draft.anchor,
          color: color || draftColor,
        });

        setNotes((current) => {
          const next = [...current, saved];
          onNotesChange?.(next);
          return next;
        });
        setDraft(null);
        setDraftColor(DEFAULT_NOTE_COLOR);
        clearBrowserSelection();
        onTogglePanel?.(true);
      } finally {
        setIsSaving(false);
      }
    },
    [clearBrowserSelection, docId, draft, draftColor, isSaving, onNotesChange, onTogglePanel, viewMode]
  );

  const handleDelete = useCallback(
    async (noteId) => {
      if (!docId) return;
      await removeNotebookNote(docId, noteId);
      if (activeNote?.id === noteId) setActiveNote(null);
      setNotes((current) => {
        const next = current.filter((note) => note.id !== noteId);
        onNotesChange?.(next);
        return next;
      });
    },
    [activeNote, docId, onNotesChange]
  );

  const handleUpdate = useCallback(
    async (noteId, payload) => {
      if (!docId || isSaving) return;

      setIsSaving(true);
      try {
        const updated = await editNotebookNote(docId, noteId, payload);
        setNotes((current) => current.map((note) => (note.id === noteId ? updated : note)));
        setActiveNote(updated);
      } finally {
        setIsSaving(false);
      }
    },
    [docId, isSaving]
  );

  const handleOpenNote = useCallback((note) => {
    if (note.viewMode === "pdf") {
      jumpToPdfPage(note.pageNumber);
    } else {
      jumpToTextParagraph(note.paragraphIndex);
    }
    handleHighlightClick(note);
  }, [handleHighlightClick]);

  useEffect(() => {
    onTogglePanel?.(false);
  }, [docId, onTogglePanel]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setDraft(null);
        setDraftColor(DEFAULT_NOTE_COLOR);
        setActiveNote(null);
        clearBrowserSelection();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearBrowserSelection]);
  const activeCard = activeNote ? getNoteCardPosition(activeNote, NOTE_CARD_WIDTH, containerWidth) : null;
  const draftWithColor = draft ? { ...draft, color: draftColor } : null;
  const contextValue = {
    notes: notes.filter((note) => note.viewMode === viewMode),
    viewMode,
    draft: draftWithColor,
    onHighlightClick: handleHighlightClick,
  };

  return (
    <WorkspaceNotebookContext.Provider value={contextValue}>
      <div className="relative min-h-full" onMouseUp={handleMouseUp} ref={containerRef}>
        {children}

        {pendingSelection && !draft ? (
          <div
            className="absolute z-[70] flex cursor-pointer items-center gap-1.5 rounded-full border border-indigo-200 bg-white/95 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-md backdrop-blur-xs transition hover:bg-indigo-600 hover:text-white"
            data-workspace-note-action="true"
            style={{ top: Math.max(10, pendingSelection.cardTop - 36), left: pendingSelection.cardLeft }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDraftColor(DEFAULT_NOTE_COLOR);
              setDraft(pendingSelection);
              setPendingSelection(null);
              setActiveNote(null);
              clearBrowserSelection();
            }}
          >
            <span className="text-sm">✏️</span>
            <span>Tạo ghi chú</span>
          </div>
        ) : null}

        {draft ? (
          <WorkspaceNotebookPopup
            cardLeft={draft.cardLeft}
            cardTop={draft.cardTop}
            color={draftColor}
            isSaving={isSaving}
            onCancel={handleCancel}
            onColorChange={setDraftColor}
            onSave={handleSave}
            selectedText={draft.selectedText}
          />
        ) : null}

        {activeNote && activeCard ? (
          <WorkspaceNotebookViewPopup
            cardLeft={activeCard.cardLeft}
            cardTop={activeCard.cardTop}
            isSaving={isSaving}
            note={activeNote}
            onClose={() => setActiveNote(null)}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        ) : null}

        {showPanel ? (
          <WorkspaceNotebookPanel
            notes={notes}
            onClose={() => onTogglePanel?.(false)}
            onDelete={handleDelete}
            onOpenNote={handleOpenNote}
          />
        ) : null}
      </div>
    </WorkspaceNotebookContext.Provider>
  );
}
