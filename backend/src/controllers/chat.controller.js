const chatService = require('../services/chat.service');
const sessionAttachmentService = require('../services/session-attachment.service');

async function listSessions(req, res, next) {
  try {
    res.json(await chatService.listSessions({
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

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

async function attachExistingDocument(req, res, next) {
  try {
    res.json(await sessionAttachmentService.attachExistingDocument({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      documentId: req.body?.documentId,
    }));
  } catch (err) {
    next(err);
  }
}

async function uploadSessionDocument(req, res, next) {
  try {
    res.status(201).json(await sessionAttachmentService.uploadSessionDocument({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      file: req.file,
      title: req.body.title,
      subjectId: req.body.subjectId,
      tags: req.body.tags,
    }));
  } catch (err) {
    next(err);
  }
}

async function softDetachDocument(req, res, next) {
  try {
    res.json(await sessionAttachmentService.softDetachDocument({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      documentId: req.params.documentId,
    }));
  } catch (err) {
    next(err);
  }
}

async function restoreDocument(req, res, next) {
  try {
    res.json(await sessionAttachmentService.restoreDocument({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      documentId: req.params.documentId,
    }));
  } catch (err) {
    next(err);
  }
}

async function saveDocumentToLibrary(req, res, next) {
  try {
    res.json(await sessionAttachmentService.saveToLibrary({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      documentId: req.params.documentId,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSessions,
  getOrCreateSession,
  getMessages,
  sendMessage,
  shareSessionWithUser,
  removeUserShare,
  createPublicLink,
  revokePublicLink,
  attachExistingDocument,
  uploadSessionDocument,
  softDetachDocument,
  restoreDocument,
  saveDocumentToLibrary,
};
