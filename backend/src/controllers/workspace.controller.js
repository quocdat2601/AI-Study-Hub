const workspaceService = require('../services/workspace.service');

async function getBootstrap(req, res, next) {
  try {
    res.json(await workspaceService.getBootstrap({
      userId: req.user.id,
      search: req.query.search,
      subjectId: req.query.subjectId,
    }));
  } catch (err) {
    next(err);
  }
}

async function getDocumentContext(req, res, next) {
  try {
    res.json(await workspaceService.getDocumentContext({
      userId: req.user.id,
      docId: req.params.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function getDocumentPdf(req, res, next) {
  try {
    const { buffer, mimeType, fileName } = await workspaceService.getDocumentPdf({
      userId: req.user.id,
      docId: req.params.id,
    });

    res.setHeader('Content-Type', mimeType);
    const asciiFileName = fileName.replace(/["\\\r\n]/g, '_');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function getDocumentPreviewData(req, res, next) {
  try {
    const { buffer, mimeType, fileName } = await workspaceService.getDocumentPdf({
      userId: req.user.id,
      docId: req.params.id,
    });

    res.setHeader('Cache-Control', 'private, max-age=300');
    res.json({
      fileName,
      mimeType,
      contentBase64: buffer.toString('base64'),
    });
  } catch (err) {
    next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    res.json(await workspaceService.sendMessage({
      userId: req.user.id,
      sessionId: req.params.sessionId,
      content: req.body.content,
    }));
  } catch (err) {
    next(err);
  }
}

async function addBookmark(req, res, next) {
  try {
    res.status(201).json(await workspaceService.addBookmark({
      userId: req.user.id,
      docId: req.params.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function removeBookmark(req, res, next) {
  try {
    res.json(await workspaceService.removeBookmark({
      userId: req.user.id,
      docId: req.params.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function listNotes(req, res, next) {
  try {
    res.json(await workspaceService.listNotes({
      userId: req.user.id,
      docId: req.params.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function createNote(req, res, next) {
  try {
    res.status(201).json(await workspaceService.createNote({
      userId: req.user.id,
      docId: req.params.id,
      payload: req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function deleteNote(req, res, next) {
  try {
    res.json(await workspaceService.deleteNote({
      userId: req.user.id,
      docId: req.params.id,
      noteId: req.params.noteId,
    }));
  } catch (err) {
    next(err);
  }
}

async function updateNote(req, res, next) {
  try {
    res.json(await workspaceService.updateNote({
      userId: req.user.id,
      docId: req.params.id,
      noteId: req.params.noteId,
      payload: req.body,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBootstrap,
  getDocumentContext,
  getDocumentPdf,
  getDocumentPreviewData,
  sendMessage,
  addBookmark,
  removeBookmark,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
};
