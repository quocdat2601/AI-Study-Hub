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

/**
 * Cập nhật tiêu đề / môn học (chỉ chủ tài liệu hoặc admin)
 */
async function updateDocument(req, res, next) {
  try {
    res.json(await documentService.updateDocument({
      document: req.document,
      title: req.body.title,
      subjectId: req.body.subjectId,
      tags: req.body.tags,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Xóa mềm tài liệu (chủ/admin) — chuyển vào thùng rác, file vẫn trên cloud
 */
async function deleteDocument(req, res, next) {
  try {
    res.json(await documentService.softDeleteDocument({
      document: req.document,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Danh sách thùng rác của user
 */
async function listTrash(req, res, next) {
  try {
    res.json(await documentService.listTrash({ userId: req.user.id }));
  } catch (err) {
    next(err);
  }
}

/**
 * Khôi phục tài liệu từ thùng rác (chủ/admin)
 */
async function restoreDocument(req, res, next) {
  try {
    res.json(await documentService.restoreDocument({
      id: req.params.id,
      userId: req.user.id,
      role: req.user.role,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Xóa cứng vĩnh viễn (chỉ admin)
 */
async function purgeDocument(req, res, next) {
  try {
    res.json(await documentService.purgeDocument({
      id: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function listDocumentShares(req, res, next) {
  try {
    res.json(await documentService.listDocumentShares({
      document: req.document,
    }));
  } catch (err) {
    next(err);
  }
}

async function shareDocument(req, res, next) {
  try {
    res.status(201).json(await documentService.shareDocument({
      document: req.document,
      userId: req.user.id,
      email: req.body.email,
    }));
  } catch (err) {
    next(err);
  }
}

async function revokeDocumentShare(req, res, next) {
  try {
    res.json(await documentService.revokeDocumentShare({
      document: req.document,
      shareId: req.params.shareId,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllDocuments,
  getDocumentById,
  getSignedUrl,
  updateDocument,
  deleteDocument,
  listTrash,
  restoreDocument,
  purgeDocument,
  listDocumentShares,
  shareDocument,
  revokeDocumentShare,
};
