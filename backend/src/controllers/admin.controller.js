const adminService = require('../services/admin.service');

async function listUsers(req, res, next) {
  try {
    const users = await adminService.listUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const user = await adminService.updateUserStatus({
      targetUserId: req.params.id,
      status: req.body.status,
      currentUserId: req.user.id,
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  updateUserStatus,
};
