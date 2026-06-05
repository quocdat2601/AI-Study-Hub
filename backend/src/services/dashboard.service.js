const userModel = require('../models/user.model');
const documentModel = require('../models/document.model');
const bookmarkModel = require('../models/bookmark.model');
const chatModel = require('../models/chat.model');
const subjectModel = require('../models/subject.model');
const createError = require('../utils/createError');

async function getDashboardData(userId) {
  const user = await userModel.findById(userId);
  if (!user) {
    throw createError(404, 'User not found');
  }

  const [docCount, recentDocs, usedStorage, bookmarkCount, chatCount, subjects] = await Promise.all([
    documentModel.countByUserId(userId),
    documentModel.findRecentByUserId(userId, 5),
    documentModel.sumStorageByUserId(userId),
    bookmarkModel.countByUserId(userId),
    chatModel.countByUserId(userId),
    subjectModel.findAll(),
  ]);

  return {
    storage: {
      limit: user.storage_limit_bytes,
      used: usedStorage,
    },
    stats: {
      documents: docCount,
      bookmarks: bookmarkCount,
      chats: chatCount,
    },
    recentDocuments: recentDocs,
    subjects,
  };
}

module.exports = {
  getDashboardData,
};
