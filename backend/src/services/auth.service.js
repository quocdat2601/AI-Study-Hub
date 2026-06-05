const userModel = require('../models/user.model');
const createError = require('../utils/createError');
const { publicUser } = require('./user.service');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function syncUserProfile(authUser) {
  if (!authUser?.id) {
    throw createError(401, 'Invalid or expired token');
  }

  const normalizedEmail = normalizeEmail(authUser.email);
  let user = await userModel.findById(authUser.id);

  if (!user) {
    if (!normalizedEmail) {
      throw createError(403, 'Authenticated account is missing an email address');
    }

    user = await userModel.create({
      id: authUser.id,
      email: normalizedEmail,
      role: 'user',
      status: 'active',
      last_login_at: authUser.last_sign_in_at || null,
    });
  } else if (normalizedEmail && user.email !== normalizedEmail) {
    user = await userModel.update(authUser.id, {
      email: normalizedEmail,
      updated_at: new Date().toISOString(),
    });
  }

  if (!user) {
    throw createError(403, 'User profile not found');
  }

  if (user.status === 'disabled') {
    throw createError(403, 'Account suspended');
  }

  return publicUser(user);
}

module.exports = {
  syncUserProfile,
};
