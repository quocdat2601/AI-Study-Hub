const aiService = require('./ai.service');
const activityService = require('./activity.service');
const chatModel = require('../models/chat.model');
const chatService = require('./chat.service');
const documentModel = require('../models/document.model');
const documentService = require('./document.service');
const uploadDocService = require('./uploadDoc.service');
const createError = require('../utils/createError');
const documentChunkModel = require('../models/document-chunk.model');
const crypto = require('crypto');

const SESSION_DOCUMENT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SESSION_DOCUMENTS = 20;
const MAX_ADDITIONAL_ATTACHMENTS = 19;

function normalizeNumericId(value, fieldName) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw createError(400, `${fieldName} is invalid`);
  }
  return numericValue;
}

function isAttachmentLimitError(error) {
  return error?.code === '23514'
    && String(error?.message || '').includes('20 active documents');
}

function attachmentLimitError() {
  return createError(409, `A chat session can contain at most ${MAX_SESSION_DOCUMENTS} active documents (1 primary document and ${MAX_ADDITIONAL_ATTACHMENTS} attachments)`);
}

function normalizeUploadRequestId(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw createError(400, 'uploadRequestId must be a UUID');
  }
  return normalized;
}

function mapLifecycleConflict(error) {
  const message = String(error?.message || '');
  if (error?.code === '55000' && message.includes('cleanup is in progress')) {
    return createError(409, 'Session attachment cleanup is in progress. Please retry shortly.');
  }
  if (error?.code === '55000' && message.includes('recovery window has ended')) {
    return createError(410, 'Session attachment has been permanently purged or is no longer recoverable');
  }
  if (isAttachmentLimitError(error)) return attachmentLimitError();
  return error;
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
  if (count >= MAX_SESSION_DOCUMENTS) {
    throw attachmentLimitError();
  }
}

async function attachWithLimitHandling(sessionId, docIds, options) {
  try {
    return await chatModel.attachDocuments(sessionId, docIds, options);
  } catch (error) {
    if (isAttachmentLimitError(error)) throw attachmentLimitError();
    throw error;
  }
}

async function getUpdatedSessionPayload(sessionId, userId) {
  return chatService.getMessages({ sessionId, userId });
}

async function attachmentProcessing(document, sessionId, processingError = null) {
  const chunkCount = document ? await documentChunkModel.countByDocumentId(document.id) : 0;
  const extractionStatus = document?.extraction_status || 'failed';
  const usableForChat = extractionStatus === 'ready' && chunkCount > 0;
  return {
    documentId: document?.id || null,
    extractionStatus,
    indexingStatus: usableForChat ? 'ready' : processingError ? 'failed' : 'pending',
    usableForChat,
    processingError: processingError || null,
  };
}

async function processSessionDocument({ document, session, userId }) {
  const claimToken = crypto.randomUUID();
  const claimed = await documentModel.claimSessionDocumentProcessing({
    documentId: document.id,
    sessionId: session.id,
    userId,
    claimToken,
  });
  if (!claimed) throw createError(409, 'This attachment is already processing. Please retry shortly.');

  try {
    await aiService.processDocument({
      id: document.id,
      userId,
      allowSessionScoped: true,
      sessionId: session.id,
    });
    const refreshed = await documentModel.findActiveSessionScopedById(document.id, session.id);
    return attachmentProcessing(refreshed || document, session.id);
  } catch (error) {
    const refreshed = await documentModel.findActiveSessionScopedById(document.id, session.id).catch(() => document);
    return attachmentProcessing(refreshed || document, session.id, error.message);
  } finally {
    await documentModel.releaseSessionDocumentProcessing({ documentId: document.id, claimToken }).catch((error) => {
      console.error(`Session attachment ${document.id} processing claim release failed:`, error.message);
    });
  }
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

async function uploadSessionDocument({ sessionId, userId, file, title, subjectId, tags, uploadRequestId }) {
  const session = await requireOwnedSession(userId, sessionId);
  const requestId = normalizeUploadRequestId(uploadRequestId);
  const existingLink = await chatModel.findSessionDocumentByUploadRequestId(session.id, requestId);
  if (existingLink) {
    const existingDocument = await documentModel.findActiveSessionScopedById(existingLink.doc_id, session.id);
    return {
      ...(await getUpdatedSessionPayload(session.id, userId)),
      attachmentProcessing: await attachmentProcessing(existingDocument, session.id),
    };
  }
  await assertAttachmentSlotAvailable(session.id);

  const expiresAt = new Date(Date.now() + SESSION_DOCUMENT_LIFETIME_MS).toISOString();
  let result;
  try {
    result = await uploadDocService.upload({
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
        await attachWithLimitHandling(session.id, [document.id], { uploadRequestId: requestId });
      },
    });
  } catch (error) {
    if (error?.code === '23505' && requestId) {
      const concurrentLink = await chatModel.findSessionDocumentByUploadRequestId(session.id, requestId);
      if (concurrentLink) {
        const concurrentDocument = await documentModel.findActiveSessionScopedById(concurrentLink.doc_id, session.id);
        return {
          ...(await getUpdatedSessionPayload(session.id, userId)),
          attachmentProcessing: await attachmentProcessing(concurrentDocument, session.id),
        };
      }
    }
    throw error;
  }

  const processing = await processSessionDocument({ document: result.document, session, userId });

  activityService.log({
    userId,
    action: 'chat.attachment.upload',
    targetType: 'chat_session',
    targetId: session.id,
    metadata: { documentId: result.document.id },
  });

  return { ...(await getUpdatedSessionPayload(session.id, userId)), attachmentProcessing: processing };
}

async function reprocessSessionDocument({ sessionId, userId, documentId }) {
  const session = await requireOwnedSession(userId, sessionId);
  const docId = normalizeNumericId(documentId, 'documentId');
  const link = await chatModel.findActiveSessionDocument(session.id, docId);
  const document = await documentModel.findActiveSessionScopedById(docId, session.id);
  if (!link || !document || String(document.user_id) !== String(userId)) {
    throw createError(404, 'Active session attachment not found');
  }
  const processing = await processSessionDocument({ document, session, userId });
  return { ...(await getUpdatedSessionPayload(session.id, userId)), attachmentProcessing: processing };
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
  if (!link) {
    const purgeLog = await documentModel.findSessionPurgeLog(session.id, docId);
    throw createError(
      purgeLog ? 410 : 404,
      purgeLog ? 'Session attachment has been permanently purged' : 'Session attachment not found'
    );
  }

  const document = await documentModel.findSessionDocumentForRecovery(docId, session.id)
    || await documentModel.findActiveById(docId);
  if (!document) {
    const purgeLog = await documentModel.findSessionPurgeLog(session.id, docId);
    throw createError(
      purgeLog ? 410 : 404,
      purgeLog ? 'Session attachment has been permanently purged' : 'Session attachment is no longer available'
    );
  }
  if (document.document_scope === 'session') {
    if (
      Number(document.origin_session_id) !== Number(session.id)
      || String(document.user_id) !== String(userId)
    ) {
      throw createError(404, 'Session attachment not found');
    }
    try {
      const restored = await documentModel.restoreSessionDocument({
        id: docId,
        userId,
        sessionId: session.id,
      });
      if (!restored) throw createError(404, 'Session attachment not found');
    } catch (error) {
      throw mapLifecycleConflict(error);
    }
  } else if (!link.removed_at || !await documentService.canAttachDocumentToSession(userId, docId)) {
    throw createError(404, 'Document not found');
  } else {
    await assertAttachmentSlotAvailable(session.id);
    await attachWithLimitHandling(session.id, [docId]);
  }

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

  const document = await documentModel.findSessionDocumentForRecovery(docId, session.id);
  if (!document || String(document.user_id) !== String(userId)) {
    const purgeLog = await documentModel.findSessionPurgeLog(session.id, docId);
    throw createError(
      purgeLog ? 410 : 404,
      purgeLog ? 'Session attachment has been permanently purged' : 'Session-only document not found'
    );
  }

  let converted;
  try {
    converted = await documentModel.convertSessionDocumentToLibrary({
      id: docId,
      userId,
      sessionId: session.id,
    });
  } catch (error) {
    throw mapLifecycleConflict(error);
  }
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
  reprocessSessionDocument,
  softDetachDocument,
  restoreDocument,
  saveToLibrary,
};
