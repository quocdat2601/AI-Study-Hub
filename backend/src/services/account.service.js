const supabase = require('../config/supabase');
const accountModel = require('../models/account.model');
const documentModel = require('../models/document.model');
const activityService = require('./activity.service');
const supabaseService = require('./supabase.service');
const createError = require('../utils/createError');
const { normalizeRole } = require('./user.service');
const { buildSafeStorageFileName } = require('../utils/sanitizeFileName');

const SUPPORTED_LANGUAGES = ['en-US', 'vi-VN'];

const STORAGE_TIERS = [
  { plan: 'Student Plan', bytes: 524288000 },
  { plan: 'Pro Plan', bytes: 1073741824 },
  { plan: 'Premium Plan', bytes: 5368709120 },
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function buildDefaultHandle(email) {
  const base = normalizeEmail(email).split('@')[0] || 'student';
  return base.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
}

function normalizeHandle(handle) {
  return String(handle || '')
    .trim()
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .slice(0, 30);
}

function formatActivityItem(log) {
  const labels = {
    'document.upload': `Uploaded ${log.metadata?.title || 'a document'}`,
    'document.update': 'Updated a document',
    'document.delete': 'Deleted a document',
    'document.share': 'Shared a document',
    'bookmark.create': 'Bookmarked a document',
    'bookmark.delete': 'Removed a bookmark',
    'chat.message.send': "AI Chat session",
    'account.profile.update': 'Updated profile',
    'account.password.update': 'Changed password',
    'account.email.update': 'Updated email',
    'account.preferences.update': 'Updated preferences',
    'account.avatar.update': 'Updated profile photo',
    'account.storage.upgrade': 'Upgraded storage plan',
  };

  return {
    id: log.id,
    action: log.action,
    title: labels[log.action] || log.action,
    createdAt: log.created_at,
  };
}

function getPlanName(limitBytes) {
  const tier = [...STORAGE_TIERS].reverse().find((item) => limitBytes >= item.bytes);
  return tier?.plan || 'Student Plan';
}

function getNextStorageTier(currentLimit) {
  const current = Number(currentLimit) || STORAGE_TIERS[0].bytes;
  return STORAGE_TIERS.find((tier) => tier.bytes > current) || null;
}

async function resolveAvatarUrl(avatarPath) {
  if (!avatarPath) return null;
  try {
    return await supabaseService.getSignedUrl(avatarPath, 3600);
  } catch {
    return null;
  }
}

function mapAccount(user, storage, docCount, activities, avatarUrl) {
  const email = user.email;
  const handle = user.handle || buildDefaultHandle(email);

  return {
    profile: {
      id: user.id,
      email,
      displayName: user.display_name || email.split('@')[0],
      handle: `@${handle}`,
      major: user.major || 'Student · AI Study Hub',
      role: normalizeRole(user.role),
      plan: getPlanName(user.storage_limit_bytes),
      avatarUrl,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
    },
    storage: {
      used: storage,
      limit: user.storage_limit_bytes,
      documentCount: docCount,
      plan: getPlanName(user.storage_limit_bytes),
      nextPlan: getNextStorageTier(user.storage_limit_bytes)?.plan || null,
    },
    preferences: {
      theme: user.theme || 'light',
      language: user.language || 'en-US',
    },
    recentActivity: activities.map(formatActivityItem),
  };
}

function handleAccountError(err) {
  if (err.code === 'ACCOUNT_MIGRATION_REQUIRED') {
    throw createError(503, err.message);
  }
  throw err;
}

async function getAccount(userId) {
  let user;
  try {
    user = await accountModel.findByUserId(userId);
  } catch (err) {
    handleAccountError(err);
  }

  if (!user) {
    throw createError(404, 'Account not found');
  }

  const [docCount, usedStorage, activities] = await Promise.all([
    documentModel.countByUserId(userId),
    documentModel.sumStorageByUserId(userId),
    activityService.listByUserId(userId, 8),
  ]);

  const avatarUrl = await resolveAvatarUrl(user.avatar_path);

  return mapAccount(user, usedStorage, docCount, activities, avatarUrl);
}

async function updateProfile(userId, payload) {
  const displayName = String(payload.displayName || '').trim();
  const handle = normalizeHandle(payload.handle);
  const major = String(payload.major || '').trim();

  if (!displayName) {
    throw createError(400, 'Display name is required');
  }

  if (!handle) {
    throw createError(400, 'Handle is required');
  }

  const existingHandle = await accountModel.findByHandle(handle);
  if (existingHandle && existingHandle.id !== userId) {
    throw createError(409, 'Handle is already taken');
  }

  let user;
  try {
    user = await accountModel.updateProfile(userId, {
      display_name: displayName,
      handle,
      major: major || null,
    });
  } catch (err) {
    handleAccountError(err);
  }

  activityService.log({
    userId,
    action: 'account.profile.update',
    targetType: 'user',
    targetId: userId,
    metadata: { displayName, handle },
  });

  return mapAccount(
    user,
    await documentModel.sumStorageByUserId(userId),
    await documentModel.countByUserId(userId),
    await activityService.listByUserId(userId, 8),
    await resolveAvatarUrl(user.avatar_path)
  );
}

async function updatePreferences(userId, payload) {
  const theme = payload.theme === 'dark' ? 'dark' : 'light';
  const languageInput = String(payload.language || 'en-US').trim() || 'en-US';
  const language = SUPPORTED_LANGUAGES.includes(languageInput) ? languageInput : 'en-US';

  let user;
  try {
    user = await accountModel.updateProfile(userId, {
      theme,
      language,
    });
  } catch (err) {
    handleAccountError(err);
  }

  activityService.log({
    userId,
    action: 'account.preferences.update',
    targetType: 'user',
    targetId: userId,
    metadata: { theme, language },
  });

  return {
    preferences: {
      theme: user.theme,
      language: user.language,
    },
  };
}

async function updateEmail(userId, payload) {
  const email = normalizeEmail(payload.email);
  if (!email || !email.includes('@')) {
    throw createError(400, 'Valid email is required');
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });

  if (error) {
    throw createError(400, error.message || 'Could not update email');
  }

  let user;
  try {
    user = await accountModel.updateProfile(userId, { email });
  } catch (err) {
    handleAccountError(err);
  }

  activityService.log({
    userId,
    action: 'account.email.update',
    targetType: 'user',
    targetId: userId,
    metadata: { email },
  });

  return { email: user.email };
}

async function updatePassword(userId, payload) {
  const newPassword = String(payload.newPassword || '');
  if (newPassword.length < 8) {
    throw createError(400, 'Password must be at least 8 characters');
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    throw createError(400, error.message || 'Could not update password');
  }

  activityService.log({
    userId,
    action: 'account.password.update',
    targetType: 'user',
    targetId: userId,
  });

  return { message: 'Password updated successfully' };
}

async function uploadAvatar(userId, file) {
  if (!file?.buffer) {
    throw createError(400, 'Avatar image is required');
  }

  const currentUser = await accountModel.findByUserId(userId);
  if (!currentUser) {
    throw createError(404, 'Account not found');
  }

  if (currentUser.avatar_path) {
    await supabaseService.deleteFile(currentUser.avatar_path).catch(() => {});
  }

  const storagePath = `avatars/${userId}/${buildSafeStorageFileName(file.originalname || 'avatar.jpg')}`;
  await supabaseService.uploadFile(file.buffer, storagePath, file.mimetype, { upsert: true });

  let user;
  try {
    user = await accountModel.updateProfile(userId, { avatar_path: storagePath });
  } catch (err) {
    await supabaseService.deleteFile(storagePath).catch(() => {});
    handleAccountError(err);
  }

  activityService.log({
    userId,
    action: 'account.avatar.update',
    targetType: 'user',
    targetId: userId,
  });

  const avatarUrl = await resolveAvatarUrl(user.avatar_path);

  return {
    avatarUrl,
    message: 'Avatar updated successfully',
  };
}

async function upgradeStorage(userId) {
  const user = await accountModel.findByUserId(userId);
  if (!user) {
    throw createError(404, 'Account not found');
  }

  const nextTier = getNextStorageTier(user.storage_limit_bytes);
  if (!nextTier) {
    throw createError(400, 'You are already on the highest storage plan');
  }

  const updatedUser = await accountModel.updateProfile(userId, {
    storage_limit_bytes: nextTier.bytes,
  });

  activityService.log({
    userId,
    action: 'account.storage.upgrade',
    targetType: 'user',
    targetId: userId,
    metadata: { plan: nextTier.plan, limitBytes: nextTier.bytes },
  });

  const [docCount, usedStorage, activities] = await Promise.all([
    documentModel.countByUserId(userId),
    documentModel.sumStorageByUserId(userId),
    activityService.listByUserId(userId, 8),
  ]);

  return {
    message: `Upgraded to ${nextTier.plan}`,
    account: mapAccount(
      updatedUser,
      usedStorage,
      docCount,
      activities,
      await resolveAvatarUrl(updatedUser.avatar_path)
    ),
  };
}

module.exports = {
  getAccount,
  updateProfile,
  updatePreferences,
  updateEmail,
  updatePassword,
  uploadAvatar,
  upgradeStorage,
  SUPPORTED_LANGUAGES,
  STORAGE_TIERS,
};
