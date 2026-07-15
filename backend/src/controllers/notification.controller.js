const notificationService = require('../services/notification.service');

async function getAllNotifications(req, res, next) {
  try {
    res.json(await notificationService.listNotifications(req.user.id, req.user.role));
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    res.json(await notificationService.markAllRead(req.user.id));
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    res.json(await notificationService.markRead({
      id: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllNotifications,
  markAllRead,
  markRead
};
