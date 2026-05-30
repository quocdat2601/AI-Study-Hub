const userModel = require('../models/user.model');
const subjectService = require('./subject.service');
const activityService = require('./activity.service');
const createError = require('../utils/createError');
const { publicUser } = require('./user.service');

async function listUsers() {
  const users = await userModel.findAll();
  return users.map(publicUser);
}

async function updateUser({ targetUserId, updates, currentUserId }) {
  const dbUpdates = {};

  if (updates.status !== undefined) {
    if (!['active', 'disabled'].includes(updates.status)) {
      throw createError(400, 'Status must be active or disabled');
    }

    if (Number(targetUserId) === Number(currentUserId) && updates.status === 'disabled') {
      throw createError(400, 'You cannot disable your own account');
    }

    dbUpdates.status = updates.status;
  }

  if (updates.storage_limit_bytes !== undefined) {
    const storageLimit = Number(updates.storage_limit_bytes);
    if (!Number.isInteger(storageLimit) || storageLimit <= 0) {
      throw createError(400, 'Storage limit must be a positive integer');
    }

    dbUpdates.storage_limit_bytes = storageLimit;
  }

  if (!Object.keys(dbUpdates).length) {
    throw createError(400, 'No supported user updates provided');
  }

  dbUpdates.updated_at = new Date().toISOString();

  const user = await userModel.update(targetUserId, dbUpdates);
  if (!user) {
    throw createError(404, 'User not found');
  }

  activityService.log({
    userId: currentUserId,
    action: 'admin.user.update',
    targetType: 'user',
    targetId: user.id,
    metadata: dbUpdates,
  });

  return publicUser(user);
}

module.exports = {
  listUsers,
  updateUser,
  listSubjects: subjectService.listSubjects,
  createSubject: subjectService.createSubject,
  listActivityLogs: activityService.listLatest,
};
