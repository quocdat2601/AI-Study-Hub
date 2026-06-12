const accountService = require('../services/account.service');

async function getAccount(req, res, next) {
  try {
    res.json(await accountService.getAccount(req.user.id));
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    res.json(await accountService.updateProfile(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function updatePreferences(req, res, next) {
  try {
    res.json(await accountService.updatePreferences(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function updateEmail(req, res, next) {
  try {
    res.json(await accountService.updateEmail(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function updatePassword(req, res, next) {
  try {
    res.json(await accountService.updatePassword(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function uploadAvatar(req, res, next) {
  try {
    res.json(await accountService.uploadAvatar(req.user.id, req.file));
  } catch (err) {
    next(err);
  }
}

async function upgradeStorage(req, res, next) {
  try {
    res.json(await accountService.upgradeStorage(req.user.id));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAccount,
  updateProfile,
  updatePreferences,
  updateEmail,
  updatePassword,
  uploadAvatar,
  upgradeStorage,
};
