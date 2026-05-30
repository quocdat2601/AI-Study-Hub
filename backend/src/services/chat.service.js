const chatModel = require('../models/chat.model');
const geminiService = require('./gemini.service');
const activityService = require('./activity.service');
const createError = require('../utils/createError');

const MAX_MESSAGE_CHARS = 4000;

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

async function getOrCreateSession({ userId, docId }) {
  return chatModel.findOrCreateSession(userId, docId);
}

async function getMessages(sessionId) {
  return chatModel.getMessages(sessionId);
}

async function sendMessage({ sessionId, userId, content }) {
  const cleanedContent = cleanMessage(content);
  const userMessage = await chatModel.addMessage(sessionId, 'user', cleanedContent);
  const aiResponse = await geminiService.queryDocument(cleanedContent, 'This is a context placeholder');
  const assistantMessage = await chatModel.addMessage(sessionId, 'assistant', aiResponse);

  activityService.log({
    userId,
    action: 'chat.message.send',
    targetType: 'chat_session',
    targetId: Number(sessionId),
  });

  return { userMessage, assistantMessage };
}

module.exports = {
  getOrCreateSession,
  getMessages,
  sendMessage,
};
