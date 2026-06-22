import {
  createWorkspaceNote,
  deleteWorkspaceNote,
  listWorkspaceNotes,
  updateWorkspaceNote,
} from "../services/workspaceApi.js";

import { DEFAULT_NOTE_COLOR, normalizeNoteColor } from "./workspaceNotebookColors.js";

function mapNote(note) {
  if (!note) return null;
  return {
    id: note.id,
    docId: String(note.doc_id),
    viewMode: note.view_mode,
    selectedText: note.selected_text,
    content: note.content,
    pageNumber: note.page_number,
    paragraphIndex: note.paragraph_index,
    anchor: note.anchor || {},
    color: normalizeNoteColor(note.color || note.anchor?.color),
    createdAt: note.created_at,
  };
}

export async function loadNotebookNotes(docId) {
  if (!docId) return [];
  const data = await listWorkspaceNotes(docId);
  return (data.notes || []).map(mapNote);
}

export async function addNotebookNote(docId, payload) {
  const data = await createWorkspaceNote(docId, payload);
  return mapNote(data.note);
}

export async function editNotebookNote(docId, noteId, payload) {
  const data = await updateWorkspaceNote(docId, noteId, payload);
  return mapNote(data.note);
}

export async function removeNotebookNote(docId, noteId) {
  await deleteWorkspaceNote(docId, noteId);
}
