const userModel = require('../models/user.model');
const documentModel = require('../models/document.model');
const createError = require('../utils/createError');

async function getDashboardData(userId) {
  const user = await userModel.findById(userId);
  if (!user) {
    throw createError(404, 'User not found');
  }

  const [docCount, recentDocs, usedStorage] = await Promise.all([
    documentModel.countByUserId(userId),
    documentModel.findRecentByUserId(userId, 5),
    documentModel.sumStorageByUserId(userId),
  ]);

  return {
    storage: {
      limit: user.storage_limit_bytes,
      used: usedStorage,
    },
    stats: {
      documents: docCount,
    },
    recentDocuments: recentDocs,
  };
}

module.exports = {
  getDashboardData,
};
