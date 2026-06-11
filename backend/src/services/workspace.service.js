const bookmarkService = require('./bookmark.service');
const chatService = require('./chat.service');
const documentService = require('./document.service');
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

  const document = await documentService.getDocumentById({ id, userId });
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
  const document = await documentService.getDocumentById({ id, userId });
  const storagePath = document.cloud_files?.storage_path;

  if (!storagePath) {
    throw createError(404, 'File not found');
  }

  const blob = await supabaseService.downloadFileBlob(storagePath);
  const buffer = Buffer.from(await blob.arrayBuffer());

  return {
    buffer,
    mimeType: document.cloud_files?.mime_type || 'application/pdf',
    fileName: document.title || 'document',
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

module.exports = {
  getBootstrap,
  getDocumentContext,
  getDocumentPdf,
  sendMessage,
  addBookmark,
  removeBookmark,
};
