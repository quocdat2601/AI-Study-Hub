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
const NO_DOCUMENT_TEXT = 'No attached document text is available yet.';

function hasReadyDocumentText(documents) {
  return (documents || []).some((doc) => (
    doc.extraction_status === 'ready' && String(doc.extracted_text || '').trim()
  ));
}

function buildExtractionReply(documents) {
  const doc = (documents || [])[0];
  if (!doc) {
    return 'No document is attached to this chat session yet.';
  }

  if (doc.extraction_status === 'pending') {
    return 'This document is still being processed. Please wait a moment and try again.';
  }

  if (doc.extraction_status === 'empty') {
    return 'This document has no readable text (for example, a scanned PDF). AI answers need selectable text in the file.';
  }

  if (doc.extraction_status === 'failed') {
    return doc.extraction_error || 'Text extraction failed for this document. Please upload the file again or use a text-based PDF.';
  }

  return 'Document text is not ready yet. Please try again in a moment.';
}

function mapSessionResponse(session) {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    lastActivityAt: session.last_activity_at,
  };
}

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
  };
}

function buildSessionPayload(session, documents, messages, canWrite) {
  return {
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      lastActivityAt: session.last_activity_at,
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

async function buildChatContext(documents) {
  const readyTexts = (documents || [])
    .map((doc) => ({
      title: doc.title,
      text: String(doc.extracted_text || '').trim(),
    }))
    .filter((doc) => doc.text);

  if (!readyTexts.length) {
    return NO_DOCUMENT_TEXT;
  }

  let context = '';
  for (const doc of readyTexts) {
    const nextChunk = `[Document: ${doc.title}]\n${doc.text}\n\n`;
    if ((context + nextChunk).length > MAX_CONTEXT_CHARS) break;
    context += nextChunk;
  }

  return context.trim() || NO_DOCUMENT_TEXT;
}

async function ensureDocumentsHaveText({ documents, userId, sessionId }) {
  if (hasReadyDocumentText(documents)) {
    return documents;
  }

  const firstDocument = (documents || [])[0];
  if (!firstDocument?.id) {
    return documents;
  }

  await documentService.reextractDocumentText({
    id: firstDocument.id,
    userId,
  });

  return chatModel.listSessionDocuments(sessionId);
}

async function getOrCreateSession({ userId, docId }) {
  const normalizedDocId = normalizeNumericId(docId, 'docId');
  const document = await documentService.canUseDocumentInChat(userId, normalizedDocId);
  if (!document) {
    throw createError(404, 'Document not found');
  }

  const existingSession = await chatModel.findMostRecentOwnedSessionByDocument(userId, normalizedDocId);
  if (existingSession) {
    return mapSessionResponse(existingSession);
  }

  const session = await chatModel.createSession(userId, document.title || 'New chat');
  await chatModel.attachDocuments(session.id, [normalizedDocId]);
  return mapSessionResponse(session);
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
  let documents = await chatModel.listSessionDocuments(session.id);
  documents = await ensureDocumentsHaveText({
    documents,
    userId,
    sessionId: session.id,
  });
  const context = await buildChatContext(documents);

  const userMessage = await chatModel.addMessage(session.id, 'user', cleanedContent);

  let assistantMessage;
  if (context === NO_DOCUMENT_TEXT) {
    assistantMessage = await chatModel.addMessage(
      session.id,
      'assistant',
      buildExtractionReply(documents)
    );
  } else {
    const aiResponse = await geminiService.queryDocument(cleanedContent, context);
    assistantMessage = await chatModel.addMessage(session.id, 'assistant', aiResponse);
  }

  await chatModel.touchSession(session.id);

  activityService.log({
    userId,
    action: 'chat.message.send',
    targetType: 'document',
    targetId: documents[0]?.id || null,
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
};
