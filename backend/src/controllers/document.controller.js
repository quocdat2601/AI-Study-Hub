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
      isAdmin: req.user.role === 'admin',
      reason: req.body.reason,
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
      isAdmin: req.user.role === 'admin',
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Xóa cứng vĩnh viễn (chủ sở hữu doc của mình, hoặc admin doc bất kỳ)
 */
async function purgeDocument(req, res, next) {
  try {
    res.json(await documentService.purgeDocument({
      id: req.params.id,
      userId: req.user.id,
      isAdmin: req.user.role === 'admin',
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Đổ sạch thùng rác của user (purge toàn bộ)
 */
async function emptyTrash(req, res, next) {
  try {
    res.json(await documentService.emptyTrash({ userId: req.user.id }));
  } catch (err) {
    next(err);
  }
}

/**
 * Xóa mềm nhiều doc cùng lúc — body: { ids: [..] }
 */
async function bulkSoftDelete(req, res, next) {
  try {
    const { ids, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    res.json(await documentService.bulkSoftDelete({
      ids,
      userId: req.user.id,
      isAdmin: req.user.role === 'admin',
      reason,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Khôi phục nhiều doc cùng lúc — body: { ids: [..] }
 */
async function bulkRestore(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    res.json(await documentService.bulkRestore({
      ids,
      userId: req.user.id,
      isAdmin: req.user.role === 'admin',
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Chạy auto-purge thủ công (chỉ admin) — để test/demo, không cần chờ cron
 */
async function purgeExpiredTrash(req, res, next) {
  try {
    res.json(await documentService.purgeExpiredTrash());
  } catch (err) {
    next(err);
  }
}

/**
 * Admin xem lịch sử xóa/khôi phục tài liệu (chỉ metadata)
 */
async function getDeletionLogs(req, res, next) {
  try {
    res.json(await documentService.listDeletionLogs({ limit: req.query.limit }));
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

async function updateDocumentVisibility(req, res, next) {
  try {
    res.json(await documentService.updateVisibility({
      id: req.params.id,
      userId: req.user.id,
      role: req.user.role,
      isPublic: req.body.isPublic === true,
    }));
  } catch (err) {
    next(err);
  }
}

async function saveOcrText(req, res, next) {
  try {
    res.json(await documentService.saveOcrText({
      document: req.document,
      text: req.body.text,
      append: req.body.append === true,
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
  emptyTrash,
  bulkSoftDelete,
  bulkRestore,
  purgeExpiredTrash,
  getDeletionLogs,
  listDocumentShares,
  shareDocument,
  revokeDocumentShare,
  updateDocumentVisibility,
  saveOcrText,
};
