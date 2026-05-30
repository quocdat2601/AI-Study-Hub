const chatService = require('../services/chat.service');

async function getOrCreateSession(req, res, next) {
  try {
    res.json(await chatService.getOrCreateSession({
      userId: req.user.id,
      docId: req.params.docId,
    }));
  } catch (err) {
    next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    res.json(await chatService.getMessages(req.params.sessionId));
  } catch (err) {
    next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    res.json(await chatService.sendMessage({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      content: req.body.content,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOrCreateSession,
  getMessages,
  sendMessage
};
