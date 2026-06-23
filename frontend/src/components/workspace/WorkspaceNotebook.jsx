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

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  const refreshNotes = useCallback(async () => {
    if (!docId) {
      setNotes([]);
      onNotesChange?.(0);
      return;
    }

    try {
      const nextNotes = await loadNotebookNotes(docId);
      setNotes(nextNotes);
      onNotesChange?.(nextNotes.length);
    } catch {
      setNotes([]);
      onNotesChange?.(0);
    }
  }, [docId, onNotesChange]);

  useEffect(() => {
    refreshNotes();
    setDraft(null);
    setDraftColor(DEFAULT_NOTE_COLOR);
    setActiveNote(null);
  }, [docId, refreshNotes]);

  const clearBrowserSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleHighlightClick = useCallback((note) => {
    setActiveNote(note);
    setDraft(null);
    clearBrowserSelection();
  }, [clearBrowserSelection]);

  const handleMouseUp = useCallback((event) => {
    if (!docId || isSavingRef.current || draftRef.current) return;
    if (event.target.closest("[data-workspace-notebook-popup], [data-workspace-notebook-panel]")) {
      return;
    }

    window.setTimeout(() => {
      if (isSavingRef.current || draftRef.current) return;

      const meta = getSelectionMeta(containerRef.current, window.getSelection());
      if (meta) {
        setDraftColor(DEFAULT_NOTE_COLOR);
        setDraft(meta);
        setActiveNote(null);
        clearBrowserSelection();
      }
    }, 0);
  }, [docId, clearBrowserSelection]);

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

        setNotes((current) => [...current, saved]);
        onNotesChange?.(notes.length + 1);
        setDraft(null);
        setDraftColor(DEFAULT_NOTE_COLOR);
        clearBrowserSelection();
        onTogglePanel?.(true);
      } finally {
        setIsSaving(false);
      }
    },
    [clearBrowserSelection, docId, draft, draftColor, isSaving, notes.length, onNotesChange, onTogglePanel, viewMode]
  );

  const handleDelete = useCallback(
    async (noteId) => {
      if (!docId) return;
      await removeNotebookNote(docId, noteId);
      if (activeNote?.id === noteId) setActiveNote(null);
      setNotes((current) => current.filter((note) => note.id !== noteId));
      onNotesChange?.(Math.max(notes.length - 1, 0));
    },
    [activeNote, docId, notes.length, onNotesChange]
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

  const containerWidth = containerRef.current?.clientWidth || 680;
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
