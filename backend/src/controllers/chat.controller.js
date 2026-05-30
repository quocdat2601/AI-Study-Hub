const chatService = require('../services/chat.service');

async function listSessions(req, res, next) {
  try {
    res.json(await chatService.listSessions(req.user.id));
  } catch (err) {
    next(err);
  }
}

async function createSession(req, res, next) {
  try {
    res.status(201).json(await chatService.createSession(req.user.id, req.body.title));
  } catch (err) {
    next(err);
  }
}

async function getSession(req, res, next) {
  try {
    res.json(await chatService.getSession({
      sessionId: req.params.sessionId,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function updateSession(req, res, next) {
  try {
    res.json(await chatService.updateSession({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      title: req.body.title,
    }));
  } catch (err) {
    next(err);
  }
}

async function deleteSession(req, res, next) {
  try {
    res.json(await chatService.deleteSession({
      sessionId: req.params.sessionId,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function addDocument(req, res, next) {
  try {
    res.status(201).json(await chatService.addDocument({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      docId: req.body.docId,
    }));
  } catch (err) {
    next(err);
  }
}

async function removeDocument(req, res, next) {
  try {
    res.json(await chatService.removeDocument({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      docId: req.params.docId,
    }));
  } catch (err) {
    next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    res.json(await chatService.getMessages({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      limit: req.query.limit,
      before: req.query.before,
    }));
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
