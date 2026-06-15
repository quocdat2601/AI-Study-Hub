const accountModel = require('../models/account.model');
const userModel = require('../models/user.model');
const createError = require('../utils/createError');
const {
  extractAuthDisplayName,
  isPlaceholderDisplayName,
  nameFromEmail,
} = require('../utils/displayName');
const { publicUser } = require('./user.service');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function buildDefaultHandle(email) {
  const base = normalizeEmail(email).split('@')[0] || 'student';
  return base.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
}

async function maybeBackfillDisplayName(authUser, accountUser) {
  if (!accountUser || (!isPlaceholderDisplayName(accountUser.display_name) && accountUser.display_name)) {
    return;
  }

  const normalizedEmail = normalizeEmail(authUser.email);
  const preferredName = extractAuthDisplayName(authUser) || nameFromEmail(normalizedEmail);
  if (isPlaceholderDisplayName(preferredName)) {
    return;
  }

  try {
    await accountModel.updateProfile(authUser.id, {
      display_name: preferredName,
      ...(accountUser.handle ? {} : { handle: buildDefaultHandle(normalizedEmail) }),
    });
  } catch {
    // Profile columns may not exist yet.
  }
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

  if (user.role === 'student') {
    user = await userModel.update(authUser.id, {
      role: 'user',
      updated_at: new Date().toISOString(),
    });
  }

  try {
    const accountUser = await accountModel.findByUserId(authUser.id);
    await maybeBackfillDisplayName(authUser, accountUser);
  } catch {
    // Ignore profile backfill errors during auth sync.
  }

  return publicUser(user);
}

module.exports = {
  syncUserProfile,
};
