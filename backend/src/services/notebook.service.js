const notebookModel = require('../models/notebook.model');
const documentService = require('./document.service');
const activityService = require('./activity.service');
const createError = require('../utils/createError');

const NOTE_MODES = new Set(['pdf', 'text']);
const NOTE_COLORS = new Set([
  'yellow', 'amber', 'orange', 'red', 'rose', 'pink', 'purple', 'indigo',
  'blue', 'cyan', 'teal', 'green', 'lime', 'gray',
]);
const MAX_SELECTED_TEXT = 2000;
const MAX_CONTENT = 5000;

function parseDocId(docId) {
  const id = Number(docId);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError(400, 'Document id is invalid');
  }
  return id;
}

function cleanText(value, fieldName, maxLength) {
  const text = String(value || '').trim();
  if (!text) {
    throw createError(400, `${fieldName} is required`);
  }
  if (text.length > maxLength) {
    throw createError(400, `${fieldName} is too long`);
  }
  return text;
}

function normalizeViewMode(viewMode) {
  const mode = String(viewMode || 'text').trim().toLowerCase();
  if (!NOTE_MODES.has(mode)) {
    throw createError(400, 'viewMode must be pdf or text');
  }
  return mode;
}

function normalizeOptionalIndex(value, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw createError(400, `${fieldName} is invalid`);
  }
  return numericValue;
}

function normalizeColor(color) {
  const value = String(color || 'yellow').trim().toLowerCase();
  return NOTE_COLORS.has(value) ? value : 'yellow';
}

function normalizeRect(rect) {
  if (!rect || typeof rect !== 'object') return null;

  const result = {};
  const fields = [
    'topRatio', 'leftRatio', 'widthRatio', 'heightRatio',
    'containerTop', 'containerLeft', 'width', 'height',
    'top', 'left',
  ];

  for (const field of fields) {
    const value = Number(rect[field]);
    if (Number.isFinite(value) && value >= 0) {
      result[field] = value;
    }
  }

  if ((result.widthRatio > 0 || result.width > 0) && (result.heightRatio > 0 || result.height > 0)) {
    return result;
  }

  return null;
}

function withAnchorColor(anchorResult, color, anchorSource = {}) {
  const normalizedColor = normalizeColor(color || anchorSource.color);
  return { ...anchorResult, color: normalizedColor };
}

function normalizeAnchor(anchor, color) {
  if (!anchor || typeof anchor !== 'object') {
    return withAnchorColor({ scope: 'container', rects: [] }, color, anchor);
  }

  const scope = anchor.scope === 'page' ? 'page' : 'container';

  if (Array.isArray(anchor.rects)) {
    const rects = anchor.rects.map(normalizeRect).filter(Boolean);
    if (rects.length) {
      return withAnchorColor({ scope, rects }, color, anchor);
    }
  }

  const ratioFields = [
    'pageTopRatio',
    'pageLeftRatio',
    'widthRatio',
    'heightRatio',
    'containerTopRatio',
    'containerLeftRatio',
  ];
  const pixelFields = ['pageTop', 'pageLeft', 'containerTop', 'containerLeft', 'width', 'height'];
  const legacy = {};

  for (const field of ratioFields) {
    const value = Number(anchor[field]);
    if (Number.isFinite(value) && value >= 0) {
      legacy[field] = value;
    }
  }

  for (const field of pixelFields) {
    const value = Number(anchor[field]);
    if (Number.isFinite(value) && value >= 0) {
      legacy[field] = value;
    }
  }

  if (Object.keys(legacy).length) {
    if (Number.isFinite(legacy.pageTopRatio)) {
      return withAnchorColor({
        scope: 'page',
        rects: [{
          topRatio: legacy.pageTopRatio,
          leftRatio: legacy.pageLeftRatio,
          widthRatio: legacy.widthRatio,
          heightRatio: legacy.heightRatio,
        }],
      }, color, anchor);
    }

    if (Number.isFinite(legacy.containerTopRatio)) {
      return withAnchorColor({
        scope: 'container',
        rects: [{
          topRatio: legacy.containerTopRatio,
          leftRatio: legacy.containerLeftRatio,
          widthRatio: legacy.widthRatio,
          heightRatio: legacy.heightRatio,
        }],
      }, color, anchor);
    }
  }

  return withAnchorColor({ scope, rects: [] }, color, anchor);
}

function enrichNote(note) {
  if (!note) return note;
  const anchor = note.anchor && typeof note.anchor === 'object' ? note.anchor : {};
  return {
    ...note,
    color: normalizeColor(note.color || anchor.color),
  };
}

async function assertDocumentAccess({ userId, docId }) {
  await documentService.getDocumentById({ id: docId, userId });
}

async function listNotes({ userId, docId }) {
  const numericDocId = parseDocId(docId);
  await assertDocumentAccess({ userId, docId: numericDocId });

  const notes = await notebookModel.findByDocAndUser(numericDocId, userId);
  return { notes: notes.map(enrichNote) };
}

async function createNote({
  userId,
  docId,
  viewMode,
  selectedText,
  content,
  pageNumber,
  paragraphIndex,
  anchor,
  color,
}) {
  const numericDocId = parseDocId(docId);
  await assertDocumentAccess({ userId, docId: numericDocId });

  const note = await notebookModel.create({
    doc_id: numericDocId,
    user_id: userId,
    view_mode: normalizeViewMode(viewMode),
    selected_text: cleanText(selectedText, 'selectedText', MAX_SELECTED_TEXT),
    content: cleanText(content, 'content', MAX_CONTENT),
    page_number: normalizeOptionalIndex(pageNumber, 'pageNumber'),
    paragraph_index: normalizeOptionalIndex(paragraphIndex, 'paragraphIndex'),
    anchor: normalizeAnchor(anchor, color),
  });

  activityService.log({
    userId,
    action: 'notebook.create',
    targetType: 'document',
    targetId: numericDocId,
    metadata: { noteId: note.id },
  });

  return { note: enrichNote(note) };
}

async function deleteNote({ userId, docId, noteId }) {
  const numericDocId = parseDocId(docId);
  const cleanedNoteId = String(noteId || '').trim();
  if (!cleanedNoteId) {
    throw createError(400, 'noteId is required');
  }

  await assertDocumentAccess({ userId, docId: numericDocId });

  const deleted = await notebookModel.deleteById({
    noteId: cleanedNoteId,
    userId,
    docId: numericDocId,
  });

  if (!deleted) {
    throw createError(404, 'Note not found');
  }

  activityService.log({
    userId,
    action: 'notebook.delete',
    targetType: 'document',
    targetId: numericDocId,
    metadata: { noteId: cleanedNoteId },
  });

  return { message: 'Note deleted' };
}

async function updateNote({ userId, docId, noteId, content, color }) {
  const numericDocId = parseDocId(docId);
  const cleanedNoteId = String(noteId || '').trim();
  if (!cleanedNoteId) {
    throw createError(400, 'noteId is required');
  }

  const hasContent = content !== undefined && content !== null;
  const hasColor = color !== undefined && color !== null && String(color).trim() !== '';
  if (!hasContent && !hasColor) {
    throw createError(400, 'content or color is required');
  }

  await assertDocumentAccess({ userId, docId: numericDocId });

  const existing = await notebookModel.findById({
    noteId: cleanedNoteId,
    userId,
    docId: numericDocId,
  });

  if (!existing) {
    throw createError(404, 'Note not found');
  }

  const updates = {};
  if (hasContent) {
    updates.content = cleanText(content, 'content', MAX_CONTENT);
  }
  if (hasColor) {
    updates.anchor = normalizeAnchor(existing.anchor, color);
  }

  const note = await notebookModel.updateById({
    noteId: cleanedNoteId,
    userId,
    docId: numericDocId,
    updates,
  });

  if (!note) {
    throw createError(404, 'Note not found');
  }

  activityService.log({
    userId,
    action: 'notebook.update',
    targetType: 'document',
    targetId: numericDocId,
    metadata: { noteId: cleanedNoteId },
  });

  return { note: enrichNote(note) };
}

module.exports = {
  listNotes,
  createNote,
  updateNote,
  deleteNote,
};
