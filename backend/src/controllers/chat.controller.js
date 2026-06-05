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
    res.json(await chatService.getMessages({
      sessionId: req.params.sessionId,
      userId: req.user.id,
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

async function shareSessionWithUser(req, res, next) {
  try {
    res.status(201).json(await chatService.shareSessionWithUser({
      sessionId: req.params.sessionId,
      ownerUserId: req.user.id,
      sharedToUserId: req.body.userId,
    }));
  } catch (err) {
    next(err);
  }
}

async function removeUserShare(req, res, next) {
  try {
    res.json(await chatService.removeUserShare({
      sessionId: req.params.sessionId,
      ownerUserId: req.user.id,
      sharedToUserId: req.params.userId,
    }));
  } catch (err) {
    next(err);
  }
}

async function createPublicLink(req, res, next) {
  try {
    res.status(201).json(await chatService.createPublicLink({
      sessionId: req.params.sessionId,
      ownerUserId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function revokePublicLink(req, res, next) {
  try {
    res.json(await chatService.revokePublicLink({
      sessionId: req.params.sessionId,
      ownerUserId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOrCreateSession,
  getMessages,
  sendMessage,
  shareSessionWithUser,
  removeUserShare,
  createPublicLink,
  revokePublicLink
};
