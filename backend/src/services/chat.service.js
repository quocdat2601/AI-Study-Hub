const chatModel = require('../models/chat.model');
const documentModel = require('../models/document.model');
const geminiService = require('./gemini.service');
const ragService = require('./rag.service');
const activityService = require('./activity.service');
const createError = require('../utils/createError');

const MAX_DOCUMENTS_PER_SESSION = 5;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TITLE_CHARS = 120;

function requireSession(session) {
  if (!session) {
    throw createError(404, 'Chat session not found');
  }
  return session;
}

function cleanTitle(title) {
  const cleaned = String(title || 'New chat').trim();
  return cleaned.slice(0, MAX_TITLE_CHARS) || 'New chat';
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

async function listSessions(userId) {
  return chatModel.listSessions(userId);
}

async function createSession(userId, title) {
  const session = await chatModel.createSession(userId, cleanTitle(title));
  activityService.log({
    userId,
    action: 'chat.session.create',
    targetType: 'chat_session',
    targetId: session.id,
  });
  return session;
}

async function getSession({ sessionId, userId }) {
  return requireSession(await chatModel.findSessionById(sessionId, userId));
}

async function updateSession({ sessionId, userId, title }) {
  await getSession({ sessionId, userId });
  return chatModel.updateSession(sessionId, userId, {
    title: cleanTitle(title),
  });
}

async function deleteSession({ sessionId, userId }) {
  await getSession({ sessionId, userId });
  await chatModel.deleteSession(sessionId, userId);
  activityService.log({
    userId,
    action: 'chat.session.delete',
    targetType: 'chat_session',
    targetId: Number(sessionId),
  });
  return { message: 'Chat session deleted' };
}

async function addDocument({ sessionId, userId, docId }) {
  const session = await getSession({ sessionId, userId });
  const numericDocId = Number(docId);

  if (!numericDocId) {
    throw createError(400, 'docId is required');
  }

  const currentDocs = session.chat_session_documents || [];
  if (currentDocs.some((row) => Number(row.doc_id) === numericDocId)) {
    throw createError(409, 'Document is already attached to this chat');
  }

  if (currentDocs.length >= MAX_DOCUMENTS_PER_SESSION) {
    throw createError(400, `A chat session can contain at most ${MAX_DOCUMENTS_PER_SESSION} documents`);
  }

  const doc = await documentModel.findAccessibleById(numericDocId, userId);
  if (!doc) {
    throw createError(404, 'Document not found');
  }
  if (doc.extraction_status !== 'ready') {
    throw createError(400, doc.extraction_error || 'This document has no readable extracted text');
  }

  const attached = await chatModel.addDocument(sessionId, numericDocId);
  activityService.log({
    userId,
    action: 'chat.document.add',
    targetType: 'document',
    targetId: numericDocId,
    metadata: { sessionId: Number(sessionId) },
  });
  return attached;
}

async function removeDocument({ sessionId, userId, docId }) {
  await getSession({ sessionId, userId });
  await chatModel.removeDocument(sessionId, docId);
  activityService.log({
    userId,
    action: 'chat.document.remove',
    targetType: 'document',
    targetId: Number(docId),
    metadata: { sessionId: Number(sessionId) },
  });
  return { message: 'Document removed from chat' };
}

async function getMessages({ sessionId, userId, limit, before }) {
  await getSession({ sessionId, userId });
  return chatModel.getMessages(sessionId, { limit, before });
}

async function sendMessage({ sessionId, userId, content }) {
  await getSession({ sessionId, userId });

  const cleanedContent = cleanMessage(content);
  const documents = await chatModel.getSessionDocuments(sessionId);

  if (!documents.length) {
    throw createError(400, 'Add at least one readable document before chatting');
  }

  const readableDocs = [];
  for (const doc of documents) {
    const accessible = await documentModel.findAccessibleById(doc.id, userId);
    if (!accessible) {
      throw createError(403, `You no longer have access to document ${doc.title || doc.id}`);
    }
    if (accessible.extraction_status !== 'ready' || !accessible.extracted_text) {
      throw createError(400, `Document "${accessible.title}" has no readable extracted text`);
    }
    readableDocs.push(accessible);
  }

  const history = await chatModel.getRecentMessages(sessionId, 20);
  const userMessage = await chatModel.addMessage(sessionId, 'user', cleanedContent);
  const documentContext = ragService.buildDocumentContext(readableDocs, cleanedContent, history);
  const aiContent = await geminiService.generateChatResponse({
    content: cleanedContent,
    history,
    documentContext,
  });
  const assistantMessage = await chatModel.addMessage(sessionId, 'assistant', aiContent);

  activityService.log({
    userId,
    action: 'chat.message.send',
    targetType: 'chat_session',
    targetId: Number(sessionId),
    metadata: { documentCount: readableDocs.length },
  });

  return { userMessage, assistantMessage };
}

module.exports = {
  listSessions,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  addDocument,
  removeDocument,
  getMessages,
  sendMessage,
};
