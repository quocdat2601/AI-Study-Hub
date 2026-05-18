const userModel = require('../models/user.model');

function createError(statusCode, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  return error;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    storageLimitBytes: user.storage_limit_bytes,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  };
}

async function listUsers() {
  const users = await userModel.listUsers();
  return users.map(publicUser);
}

async function updateUserStatus({ targetUserId, status, currentUserId }) {
  if (!['active', 'disabled'].includes(status)) {
    throw createError(400, 'Status must be active or disabled');
  }

  if (Number(targetUserId) === Number(currentUserId)) {
    throw createError(400, 'You cannot change your own account status');
  }

  const user = await userModel.updateStatus(targetUserId, status);
  if (!user) {
    throw createError(404, 'User not found');
  }

  return publicUser(user);
}

module.exports = {
  listUsers,
  updateUserStatus,
};
