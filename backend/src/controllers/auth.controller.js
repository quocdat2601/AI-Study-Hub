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
    // User đăng nhập OK nhưng chưa có profile đầy đủ — vẫn trả thông tin cơ bản.
    if (err.statusCode === 404) {
      const email = req.user?.email || '';
      const localName = email.split('@')[0] || 'Student';

      return res.json({
        user: {
          ...req.user,
          displayName: localName,
          plan: 'Student Plan',
        },
      });
    }
    next(err);
  }
}

module.exports = {
  getMe,
};
