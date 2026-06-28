const accountService = require('../services/account.service');
const preferenceService = require('../services/preference.service');

async function getMe(req, res, next) {
  try {
    const [account, onboarding] = await Promise.all([
      accountService.getAccount(req.user.id),
      preferenceService.getStatus(req.user.id),
    ]);

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
        onboarded: onboarding.onboarded,
        goal: onboarding.goal,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
};
