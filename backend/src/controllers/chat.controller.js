const Chat = require('../models/chat.model');
const geminiService = require('../services/gemini.service');

async function getOrCreateSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { docId } = req.params;
    const session = await Chat.findOrCreateSession(userId, docId);
    res.json(session);
  } catch (err) {
    next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    const { sessionId } = req.params;
    const messages = await Chat.getMessages(sessionId);
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { content } = req.body;

    // 1. Save user message
    await Chat.addMessage(sessionId, 'user', content);

    // 2. Get AI answer (simplified)
    const aiResponse = await geminiService.generateAnswer(content, 'This is a context placeholder');
    
    // 3. Save AI message
    const savedAiMsg = await Chat.addMessage(sessionId, 'assistant', aiResponse);

    res.json(savedAiMsg);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOrCreateSession,
  getMessages,
  sendMessage
};
