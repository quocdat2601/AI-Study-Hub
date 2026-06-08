const accountService = require('../services/account.service');

async function getMe(req, res, next) {
  try {
    const account = await accountService.getAccount(req.user.id);

    res.json({
      user: {
        ...req.user,
        displayName: account.profile.displayName,
        handle: account.profile.handle,
        major: account.profile.major,
        avatarUrl: account.profile.avatarUrl,
        plan: account.profile.plan,
        theme: account.preferences.theme,
        language: account.preferences.language,
        last_login_at: account.profile.lastLoginAt,
        created_at: account.profile.createdAt,
        storage_limit_bytes: account.storage.limit,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
};
