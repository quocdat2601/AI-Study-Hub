const Notification = require('../models/notification.model');

async function getAllNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const notifications = await Notification.findByUserId(userId);
    const unreadCount = notifications.filter(n => !n.is_read).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    const userId = req.user.id;
    await Notification.markAllAsRead(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await Notification.markAsRead(id, userId);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllNotifications,
  markAllRead,
  markRead
};
