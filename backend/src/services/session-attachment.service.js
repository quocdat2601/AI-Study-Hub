const aiService = require('./ai.service');
const activityService = require('./activity.service');
const chatModel = require('../models/chat.model');
const chatService = require('./chat.service');
const documentModel = require('../models/document.model');
const documentService = require('./document.service');
const uploadDocService = require('./uploadDoc.service');
const createError = require('../utils/createError');

const SESSION_DOCUMENT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_ATTACHMENTS = 10;

function normalizeNumericId(value, fieldName) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw createError(400, `${fieldName} is invalid`);
  }
  return numericValue;
}

function isAttachmentLimitError(error) {
  return error?.code === '23514'
    && String(error?.message || '').includes('10 active attachments');
}

function attachmentLimitError() {
  return createError(409, `A chat session can contain at most ${MAX_ACTIVE_ATTACHMENTS} active attachments`);
}

async function requireOwnedSession(userId, sessionId) {
  const normalizedSessionId = normalizeNumericId(sessionId, 'sessionId');
  const session = await chatModel.findOwnedSession(normalizedSessionId, userId);
  if (!session) {
    throw createError(404, 'Chat session not found');
  }
  return session;
}

async function assertAttachmentSlotAvailable(sessionId) {
  const count = await chatModel.countActiveSessionDocuments(sessionId);
  if (count >= MAX_ACTIVE_ATTACHMENTS) {
    throw attachmentLimitError();
  }
}

async function attachWithLimitHandling(sessionId, docIds) {
  try {
    return await chatModel.attachDocuments(sessionId, docIds);
  } catch (error) {
    if (isAttachmentLimitError(error)) throw attachmentLimitError();
    throw error;
  }
}

async function getUpdatedSessionPayload(sessionId, userId) {
  return chatService.getMessages({ sessionId, userId });
}

async function attachExistingDocument({ sessionId, userId, documentId }) {
  const session = await requireOwnedSession(userId, sessionId);
  const docId = normalizeNumericId(documentId, 'documentId');
  const existingLink = await chatModel.findSessionDocumentLink(session.id, docId);

  if (!existingLink || existingLink.removed_at) {
    const document = await documentService.canAttachDocumentToSession(userId, docId);
    if (!document) {
      throw createError(404, 'Document not found');
    }
    await assertAttachmentSlotAvailable(session.id);
    await attachWithLimitHandling(session.id, [docId]);
  }

  activityService.log({
    userId,
    action: 'chat.attachment.attach',
    targetType: 'chat_session',
    targetId: session.id,
    metadata: { documentId: docId },
  });

  return getUpdatedSessionPayload(session.id, userId);
}

async function uploadSessionDocument({ sessionId, userId, file, title, subjectId, tags }) {
  const session = await requireOwnedSession(userId, sessionId);
  await assertAttachmentSlotAvailable(session.id);

  const expiresAt = new Date(Date.now() + SESSION_DOCUMENT_LIFETIME_MS).toISOString();
  const result = await uploadDocService.upload({
    userId,
    file,
    title,
    subjectId,
    tags,
    isPublic: false,
    documentScope: 'session',
    originSessionId: session.id,
    expiresAt,
    afterDocumentCreated: async (document) => {
      await attachWithLimitHandling(session.id, [document.id]);
    },
  });

  try {
    await aiService.processDocument({
      id: result.document.id,
      userId,
      allowSessionScoped: true,
      sessionId: session.id,
    });
  } catch (error) {
    console.warn(`Session attachment ${result.document.id} indexing skipped:`, error.message);
  }

  activityService.log({
    userId,
    action: 'chat.attachment.upload',
    targetType: 'chat_session',
    targetId: session.id,
    metadata: { documentId: result.document.id },
  });

  return getUpdatedSessionPayload(session.id, userId);
}

async function softDetachDocument({ sessionId, userId, documentId }) {
  const session = await requireOwnedSession(userId, sessionId);
  const docId = normalizeNumericId(documentId, 'documentId');
  const removed = await chatModel.softRemoveSessionDocument(session.id, docId, userId);
  if (!removed) {
    throw createError(404, 'Active session attachment not found');
  }

  activityService.log({
    userId,
    action: 'chat.attachment.detach',
    targetType: 'chat_session',
    targetId: session.id,
    metadata: { documentId: docId },
  });

  return getUpdatedSessionPayload(session.id, userId);
}

async function restoreDocument({ sessionId, userId, documentId }) {
  const session = await requireOwnedSession(userId, sessionId);
  const docId = normalizeNumericId(documentId, 'documentId');
  const link = await chatModel.findSessionDocumentLink(session.id, docId);
  if (!link || !link.removed_at) {
    throw createError(404, 'Soft-detached session attachment not found');
  }

  const document = await documentModel.findActiveById(docId);
  if (!document) {
    throw createError(410, 'Session attachment is no longer available');
  }
  if (document.document_scope === 'session') {
    if (
      Number(document.origin_session_id) !== Number(session.id)
      || String(document.user_id) !== String(userId)
    ) {
      throw createError(404, 'Session attachment not found');
    }
  } else if (!await documentService.canAttachDocumentToSession(userId, docId)) {
    throw createError(404, 'Document not found');
  }

  await assertAttachmentSlotAvailable(session.id);
  await attachWithLimitHandling(session.id, [docId]);

  activityService.log({
    userId,
    action: 'chat.attachment.restore',
    targetType: 'chat_session',
    targetId: session.id,
    metadata: { documentId: docId },
  });

  return getUpdatedSessionPayload(session.id, userId);
}

async function saveToLibrary({ sessionId, userId, documentId }) {
  const session = await requireOwnedSession(userId, sessionId);
  const docId = normalizeNumericId(documentId, 'documentId');
  const link = await chatModel.findSessionDocumentLink(session.id, docId);
  if (!link) {
    throw createError(404, 'Session attachment not found');
  }

  const document = await documentModel.findActiveSessionScopedById(docId, session.id);
  if (!document || String(document.user_id) !== String(userId)) {
    throw createError(404, 'Session-only document not found');
  }

  const converted = await documentModel.convertSessionDocumentToLibrary({
    id: docId,
    userId,
    sessionId: session.id,
  });
  if (!converted) {
    throw createError(409, 'Document could not be saved to My Documents');
  }

  activityService.log({
    userId,
    action: 'chat.attachment.save_to_library',
    targetType: 'chat_session',
    targetId: session.id,
    metadata: { documentId: docId },
  });

  return getUpdatedSessionPayload(session.id, userId);
}

module.exports = {
  attachExistingDocument,
  uploadSessionDocument,
  softDetachDocument,
  restoreDocument,
  saveToLibrary,
};
