const bookmarkModel = require('../models/bookmark.model');
const documentModel = require('../models/document.model');
const activityService = require('./activity.service');
const createError = require('../utils/createError');

async function listBookmarks(userId) {
  return bookmarkModel.findByUserId(userId);
}

async function addBookmark({ userId, docId }) {
  const numericDocId = Number(docId);
  if (!numericDocId) {
    throw createError(400, 'docId is required');
  }

  const doc = await documentModel.findAccessibleById(numericDocId, userId);
  if (!doc) {
    throw createError(404, 'Document not found');
  }

  try {
    const bookmark = await bookmarkModel.create(userId, numericDocId);
    activityService.log({
      userId,
      action: 'bookmark.create',
      targetType: 'document',
      targetId: numericDocId,
    });
    return bookmark;
  } catch (err) {
    if (err.code === '23505') {
      throw createError(409, 'Document is already bookmarked');
    }
    throw err;
  }
}

async function removeBookmark({ userId, docId }) {
  const numericDocId = Number(docId);
  if (!numericDocId) {
    throw createError(400, 'docId is required');
  }

  await bookmarkModel.delete(userId, numericDocId);
  activityService.log({
    userId,
    action: 'bookmark.delete',
    targetType: 'document',
    targetId: numericDocId,
  });
  return { message: 'Bookmark removed' };
}

module.exports = {
  listBookmarks,
  addBookmark,
  removeBookmark,
};
