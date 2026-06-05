const documentService = require('../services/document.service');

/**
 * List owned + shared documents
 */
async function getAllDocuments(req, res, next) {
  try {
    res.json(await documentService.listDocuments({
      userId: req.user.id,
      search: req.query.search,
      subjectId: req.query.subjectId,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Upload document
 */
async function uploadDocument(req, res, next) {
  try {
    res.status(201).json(await documentService.uploadDocument({
      userId: req.user.id,
      file: req.file,
      title: req.body.title,
      subjectId: req.body.subjectId,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Get one document
 */
async function getDocumentById(req, res, next) {
  try {
    res.json(await documentService.getDocumentById({
      id: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Get signed URL
 */
async function getSignedUrl(req, res, next) {
  try {
    res.json(await documentService.getSignedUrl({
      id: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function updateVisibility(req, res, next) {
  try {
    res.json(await documentService.updateVisibility({
      id: req.params.id,
      userId: req.user.id,
      isPublic: req.body.isPublic,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllDocuments,
  uploadDocument,
  getDocumentById,
  getSignedUrl,
  updateVisibility
};
