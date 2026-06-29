const userModel = require('../models/user.model');
const createError = require('../utils/createError');

function normalizeRole(role) {
  return role;
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: normalizeRole(user.role),
    status: user.status,
    storage_limit_bytes: user.storage_limit_bytes,
    storageLimitBytes: user.storage_limit_bytes,
    created_at: user.created_at,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  };
}

async function listUsers() {
  const users = await userModel.findAll();
  return users.map(publicUser);
}

async function getUserById(id) {
  const user = await userModel.findById(id);
  if (!user) {
    throw createError(404, 'User not found');
  }

  return publicUser(user);
}

module.exports = {
  listUsers,
  getUserById,
  publicUser,
  normalizeRole,
};
