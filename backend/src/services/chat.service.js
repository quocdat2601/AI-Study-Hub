const crypto = require('crypto');
const chatModel = require('../models/chat.model');
const userModel = require('../models/user.model');
const geminiService = require('./gemini.service');
const activityService = require('./activity.service');
const documentService = require('./document.service');
const createError = require('../utils/createError');

const MAX_MESSAGE_CHARS = 4000;
const PUBLIC_CHAT_TOKEN_BYTES = 24;
const MAX_CONTEXT_CHARS = 16000;
const MAX_SESSION_TITLE_CHARS = 120;

function cleanMessage(content) {
  const cleaned = String(content || '').trim();
  if (!cleaned) {
    throw createError(400, 'Message content is required');
  }
  if (cleaned.length > MAX_MESSAGE_CHARS) {
    throw createError(400, `Message is too long. Maximum is ${MAX_MESSAGE_CHARS} characters`);
  }
  return cleaned;
}

function normalizeNumericId(value, fieldName) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw createError(400, `${fieldName} is invalid`);
  }
  return numericValue;
}

function hashPublicToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createPublicToken() {
  return crypto.randomBytes(PUBLIC_CHAT_TOKEN_BYTES).toString('base64url');
}

function buildChatDocumentPreview(doc) {
  const preview = documentService.buildPublicDocumentPreview(doc);

  return {
    id: doc.id,
    title: doc.title,
    subject: doc.subjects?.name || null,
    subjectCode: doc.subjects?.code || null,
    previewText: preview.previewText,
    thumbnailUrl: doc.thumbnailUrl || null,
    isPublic: Boolean(doc.is_public),
    fileType: preview.fileType,
    extractionStatus: doc.extraction_status,
    documentScope: doc.document_scope || 'library',
    lifecycleStatus: doc.lifecycle_status || 'active',
    originSessionId: doc.origin_session_id || null,
    expiresAt: doc.expires_at || null,
  };
}

function cleanSessionTitle(title, fallback = 'New chat') {
  const cleaned = String(title || '').replace(/\s+/g, ' ').trim() || fallback;
  if (cleaned.length > MAX_SESSION_TITLE_CHARS) {
    throw createError(400, `Session title is too long. Maximum is ${MAX_SESSION_TITLE_CHARS} characters`);
  }
  return cleaned;
}

function buildSessionPayload(session, documents, messages, canWrite) {
  return {
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      lastActivityAt: session.last_activity_at,
      primaryDocumentId: session.primary_document_id,
    },
    documents: documents.map(buildChatDocumentPreview),
    messages,
    canWrite,
  };
}

async function withDocumentPreviews(documents) {
  return documentService.addThumbnailUrls(documents);
}

async function canReadChatSession(userId, sessionId) {
  const normalizedSessionId = normalizeNumericId(sessionId, 'sessionId');
  const session = await chatModel.findSessionById(normalizedSessionId);
  if (!session) return null;
  if (String(session.user_id) === String(userId)) return session;

  const share = await chatModel.findReadableShare(normalizedSessionId, userId);
  return share ? session : null;
}

async function canWriteChatSession(userId, sessionId) {
  const normalizedSessionId = normalizeNumericId(sessionId, 'sessionId');
  return chatModel.findOwnedSession(normalizedSessionId, userId);
}

async function listActiveSessionAttachments({ sessionId, userId }) {
  const session = await canReadChatSession(userId, sessionId);
  if (!session) {
    throw createError(404, 'Chat session not found');
  }
  return chatModel.listSessionDocuments(session.id);
}

async function findActiveSessionAttachment({ sessionId, docId, userId }) {
  const session = await canReadChatSession(userId, sessionId);
  if (!session) {
    throw createError(404, 'Chat session not found');
  }
  return chatModel.findActiveSessionDocument(session.id, normalizeNumericId(docId, 'docId'));
}

async function reattachSessionDocuments({ sessionId, docIds, userId }) {
  const session = await canWriteChatSession(userId, sessionId);
  if (!session) {
    throw createError(404, 'Chat session not found');
  }
  const normalizedDocIds = [...new Set((docIds || []).map((docId) => normalizeNumericId(docId, 'docId')))];
  const links = await Promise.all(
    normalizedDocIds.map((docId) => chatModel.findSessionDocumentLink(session.id, docId))
  );
  if (links.some((link) => !link)) {
    throw createError(404, 'Session attachment not found');
  }
  return chatModel.attachDocuments(session.id, normalizedDocIds);
}

async function softRemoveSessionAttachment({ sessionId, docId, userId }) {
  const session = await canWriteChatSession(userId, sessionId);
  if (!session) {
    throw createError(404, 'Chat session not found');
  }
  return chatModel.softRemoveSessionDocument(
    session.id,
    normalizeNumericId(docId, 'docId'),
    userId
  );
}

async function buildChatContext(documents) {
  const readyTexts = (documents || [])
    .map((doc) => ({
      title: doc.title,
      text: String(doc.extracted_text || '').trim(),
    }))
    .filter((doc) => doc.text);

  if (!readyTexts.length) {
    return 'No attached document text is available yet.';
  }

  let context = '';
  for (const doc of readyTexts) {
    const nextChunk = `[Document: ${doc.title}]\n${doc.text}\n\n`;
    if ((context + nextChunk).length > MAX_CONTEXT_CHARS) break;
    context += nextChunk;
  }

  return context.trim() || 'No attached document text is available yet.';
}

function mapSessionSummary(session) {
  const now = Date.now();
  const activeAttachments = (session.chat_session_documents || []).filter((link) => {
    const document = link.documents;
    if (link.removed_at || !document || document.deleted_at) return false;
    if (document.lifecycle_status !== 'active') return false;
    return !document.expires_at || new Date(document.expires_at).getTime() > now;
  });
  return {
    id: session.id,
    title: session.title || 'New chat',
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    lastActivityAt: session.last_activity_at,
    primaryDocumentId: session.primary_document_id,
    attachmentCount: activeAttachments.length,
    documentIds: activeAttachments.map((link) => Number(link.doc_id)),
  };
}

async function listSessions({ userId, documentId }) {
  const primaryDocumentId = normalizeNumericId(documentId, 'documentId');
  const sessions = await chatModel.listOwnedSessions(userId, primaryDocumentId);
  return { sessions: sessions.map(mapSessionSummary) };
}

async function createSession({ userId, title, documentId }) {
  const primaryDocumentId = normalizeNumericId(documentId, 'documentId');
  const document = await documentService.canAttachDocumentToSession(userId, primaryDocumentId);
  if (!document) throw createError(404, 'Document not found');

  const session = await chatModel.createSession(
    userId,
    cleanSessionTitle(title),
    primaryDocumentId
  );
  try {
    await chatModel.attachDocuments(session.id, [primaryDocumentId]);
  } catch (error) {
    await chatModel.softDeleteOwnedSession(session.id, userId).catch(() => null);
    throw error;
  }

  activityService.log({
    userId,
    action: 'chat.session.create',
    targetType: 'chat_session',
    targetId: session.id,
  });
  return getMessages({ sessionId: session.id, userId });
}

async function renameSession({ sessionId, userId, title }) {
  const normalizedSessionId = normalizeNumericId(sessionId, 'sessionId');
  const updated = await chatModel.updateOwnedSessionTitle(
    normalizedSessionId,
    userId,
    cleanSessionTitle(title)
  );
  if (!updated) throw createError(404, 'Chat session not found');

  activityService.log({
    userId,
    action: 'chat.session.rename',
    targetType: 'chat_session',
    targetId: normalizedSessionId,
  });
  return getMessages({ sessionId: normalizedSessionId, userId });
}

async function deleteSession({ sessionId, userId }) {
  const normalizedSessionId = normalizeNumericId(sessionId, 'sessionId');
  const deleted = await chatModel.softDeleteOwnedSession(normalizedSessionId, userId);
  if (!deleted) throw createError(404, 'Chat session not found');

  activityService.log({
    userId,
    action: 'chat.session.delete',
    targetType: 'chat_session',
    targetId: normalizedSessionId,
  });
  return {
    session: {
      id: deleted.id,
      title: deleted.title || 'New chat',
      createdAt: deleted.created_at,
      updatedAt: deleted.updated_at,
      lastActivityAt: deleted.last_activity_at,
      primaryDocumentId: deleted.primary_document_id,
      deletedAt: deleted.deleted_at,
    },
    documents: [],
    messages: [],
    canWrite: false,
  };
}

async function getOrCreateSession({ userId, docId }) {
  const normalizedDocId = normalizeNumericId(docId, 'docId');
  const document = await documentService.canUseDocumentInChat(userId, normalizedDocId);
  if (!document) {
    throw createError(404, 'Document not found');
  }

  const existingSession = await chatModel.findMostRecentOwnedSessionByDocument(userId, normalizedDocId);
  if (existingSession) {
    return chatModel.findSessionById(existingSession.id);
  }

  const session = await chatModel.createSession(
    userId,
    document.title || 'New chat',
    normalizedDocId
  );
  await chatModel.attachDocuments(session.id, [normalizedDocId]);
  return session;
}

async function getMessages({ sessionId, userId }) {
  const session = await canReadChatSession(userId, sessionId);
  if (!session) {
    throw createError(404, 'Chat session not found');
  }

  const [messages, documents, writableSession] = await Promise.all([
    chatModel.getMessages(session.id),
    chatModel.listSessionDocuments(session.id),
    canWriteChatSession(userId, session.id),
  ]);

  const documentsWithThumbnails = await withDocumentPreviews(documents);
  return buildSessionPayload(session, documentsWithThumbnails, messages, Boolean(writableSession));
}

async function sendMessage({ sessionId, userId, content }) {
  const session = await canWriteChatSession(userId, sessionId);
  if (!session) {
    throw createError(404, 'Chat session not found');
  }

  const cleanedContent = cleanMessage(content);
  const documents = await chatModel.listSessionDocuments(session.id);
  const context = await buildChatContext(documents);
  const hasDocumentText = context !== 'No attached document text is available yet.';

  const userMessage = await chatModel.addMessage(session.id, 'user', cleanedContent);

  const aiResponse = hasDocumentText
    ? await geminiService.queryDocument(cleanedContent, context)
    : 'Tài liệu này chưa có text để AI đọc (thường gặp với PDF scan). Bạn vẫn xem và đọc file ở tab PDF.';

  const assistantMessage = await chatModel.addMessage(session.id, 'assistant', aiResponse);
  await chatModel.touchSession(session.id);

  activityService.log({
    userId,
    action: 'chat.message.send',
    targetType: 'chat_session',
    targetId: session.id,
  });

  return { userMessage, assistantMessage };
}

async function shareSessionWithUser({ sessionId, ownerUserId, sharedToUserId }) {
  const session = await canWriteChatSession(ownerUserId, sessionId);
  if (!session) {
    throw createError(404, 'Chat session not found');
  }

  if (!String(sharedToUserId || '').trim()) {
    throw createError(400, 'userId is required');
  }

  if (String(ownerUserId) === String(sharedToUserId)) {
    throw createError(400, 'You already own this chat session');
  }

  const targetUser = await userModel.findById(sharedToUserId);
  if (!targetUser) {
    throw createError(404, 'Target user not found');
  }
  if (targetUser.status === 'disabled') {
    throw createError(403, 'Target user account is suspended');
  }

  const share = await chatModel.createOrUpdateUserShare(session.id, ownerUserId, sharedToUserId);
  activityService.log({
    userId: ownerUserId,
    action: 'chat.share.user',
    targetType: 'chat_session',
    targetId: session.id,
    metadata: {
      sharedTo: sharedToUserId,
    },
  });

  return {
    message: 'Chat session shared successfully',
    share,
  };
}

async function removeUserShare({ sessionId, ownerUserId, sharedToUserId }) {
  const session = await canWriteChatSession(ownerUserId, sessionId);
  if (!session) {
    throw createError(404, 'Chat session not found');
  }

  const share = await chatModel.revokeUserShare(session.id, sharedToUserId);
  if (!share) {
    throw createError(404, 'Chat share not found');
  }

  activityService.log({
    userId: ownerUserId,
    action: 'chat.share.user.revoke',
    targetType: 'chat_session',
    targetId: session.id,
    metadata: {
      sharedTo: sharedToUserId,
    },
  });

  return { message: 'Chat share revoked' };
}

async function createPublicLink({ sessionId, ownerUserId }) {
  const session = await canWriteChatSession(ownerUserId, sessionId);
  if (!session) {
    throw createError(404, 'Chat session not found');
  }

  const token = createPublicToken();
  await chatModel.upsertPublicLink(session.id, hashPublicToken(token), ownerUserId);

  activityService.log({
    userId: ownerUserId,
    action: 'chat.share.public.create',
    targetType: 'chat_session',
    targetId: session.id,
  });

  return {
    message: 'Public chat link created',
    publicLink: {
      token,
      path: `/api/public/chat-shares/${token}`,
      readOnly: true,
    },
  };
}

async function revokePublicLink({ sessionId, ownerUserId }) {
  const session = await canWriteChatSession(ownerUserId, sessionId);
  if (!session) {
    throw createError(404, 'Chat session not found');
  }

  await chatModel.revokePublicLink(session.id);
  activityService.log({
    userId: ownerUserId,
    action: 'chat.share.public.revoke',
    targetType: 'chat_session',
    targetId: session.id,
  });

  return { message: 'Public chat link revoked' };
}

async function getPublicChatShare(token) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw createError(404, 'Public chat share not found');
  }

  const publicLink = await chatModel.findActivePublicLinkByTokenHash(hashPublicToken(normalizedToken));
  if (!publicLink) {
    throw createError(404, 'Public chat share not found');
  }

  const session = await chatModel.findSessionById(publicLink.session_id);
  if (!session) {
    throw createError(404, 'Public chat share not found');
  }

  const [messages, documents] = await Promise.all([
    chatModel.getMessages(session.id),
    chatModel.listSessionDocuments(session.id),
  ]);

  const documentsWithThumbnails = await withDocumentPreviews(documents);
  return buildSessionPayload(session, documentsWithThumbnails, messages, false);
}

module.exports = {
  listSessions,
  createSession,
  renameSession,
  deleteSession,
  getOrCreateSession,
  getMessages,
  sendMessage,
  shareSessionWithUser,
  removeUserShare,
  createPublicLink,
  revokePublicLink,
  getPublicChatShare,
  canReadChatSession,
  canWriteChatSession,
  listActiveSessionAttachments,
  findActiveSessionAttachment,
  reattachSessionDocuments,
  softRemoveSessionAttachment,
};
