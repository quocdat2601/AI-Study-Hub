const bookmarkService = require('./bookmark.service');
const chatService = require('./chat.service');
const documentService = require('./document.service');
const notebookService = require('./notebook.service');
const subjectService = require('./subject.service');
const supabaseService = require('./supabase.service');
const createError = require('../utils/createError');

function parseDocId(docId) {
  const id = Number(docId);
  if (!Number.isInteger(id) || id <= 0) {
    throw createError(400, 'Document id is invalid');
  }
  return id;
}

function isChatReady(document) {
  const text = String(document.extracted_text || '').trim();
  return document.extraction_status === 'ready' && text.length >= 50;
}

function getFileExtension(mimeType) {
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return '.docx';
  }
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/tiff') return '.tiff';
  if (mimeType === 'image/bmp') return '.bmp';
  return '';
}

function buildDownloadFileName(title, mimeType) {
  const baseName = String(title || 'document').trim() || 'document';
  const extension = getFileExtension(mimeType);
  if (!extension || baseName.toLowerCase().endsWith(extension)) return baseName;
  return `${baseName}${extension}`;
}

async function getBootstrap({ userId, search, subjectId }) {
  const [documents, subjects, bookmarks] = await Promise.all([
    documentService.listDocuments({ userId, search, subjectId }),
    subjectService.listSubjects(),
    bookmarkService.listBookmarks(userId),
  ]);

  const bookmarkedDocIds = bookmarks
    .map((item) => item.doc_id || item.documents?.id)
    .filter(Boolean);

  return { documents, subjects, bookmarkedDocIds };
}

async function getDocumentContext({ userId, docId }) {
  const id = parseDocId(docId);

  const document = await documentService.getWorkspaceDocumentById({ id, userId });
  const session = await chatService.getOrCreateSession({ userId, docId: id });

  const [signed, chat] = await Promise.all([
    documentService.getSignedUrl({ id, userId }),
    chatService.getMessages({ sessionId: session.id, userId }),
  ]);

  const chatReady = isChatReady(document);

  return {
    document,
    signedUrl: signed.signedUrl,
    sessionId: session.id,
    messages: chat.messages || [],
    chatReady,
    chatHint: chatReady
      ? null
      : 'Tài liệu chưa có text để AI đọc (thường gặp với PDF scan). Bạn vẫn xem file ở tab PDF.',
  };
}

async function getDocumentPdf({ userId, docId }) {
  const id = parseDocId(docId);
  const document = await documentService.getWorkspaceDocumentById({ id, userId });
  const storagePath = document.cloud_files?.storage_path;

  if (!storagePath) {
    throw createError(404, 'File not found');
  }

  const blob = await supabaseService.downloadFileBlob(storagePath);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const mimeType = document.cloud_files?.mime_type || 'application/pdf';

  return {
    buffer,
    mimeType,
    fileName: buildDownloadFileName(document.title, mimeType),
  };
}

async function sendMessage({ userId, sessionId, content }) {
  return chatService.sendMessage({ userId, sessionId, content });
}

async function addBookmark({ userId, docId }) {
  return bookmarkService.addBookmark({ userId, docId: parseDocId(docId) });
}

async function removeBookmark({ userId, docId }) {
  return bookmarkService.removeBookmark({ userId, docId: parseDocId(docId) });
}

async function listNotes({ userId, docId }) {
  return notebookService.listNotes({ userId, docId: parseDocId(docId) });
}

async function createNote({ userId, docId, payload }) {
  return notebookService.createNote({
    userId,
    docId: parseDocId(docId),
    viewMode: payload.viewMode,
    selectedText: payload.selectedText,
    content: payload.content,
    pageNumber: payload.pageNumber,
    paragraphIndex: payload.paragraphIndex,
    anchor: payload.anchor,
    color: payload.color,
  });
}

async function deleteNote({ userId, docId, noteId }) {
  return notebookService.deleteNote({
    userId,
    docId: parseDocId(docId),
    noteId,
  });
}

async function updateNote({ userId, docId, noteId, payload }) {
  return notebookService.updateNote({
    userId,
    docId: parseDocId(docId),
    noteId,
    content: payload.content,
    color: payload.color,
  });
}

module.exports = {
  getBootstrap,
  getDocumentContext,
  getDocumentPdf,
  sendMessage,
  addBookmark,
  removeBookmark,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
};
