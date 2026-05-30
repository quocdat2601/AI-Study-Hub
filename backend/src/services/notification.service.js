const notificationModel = require('../models/notification.model');

async function listNotifications(userId) {
  const notifications = await notificationModel.findByUserId(userId);
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  return { notifications, unreadCount };
}

async function markAllRead(userId) {
  await notificationModel.markAllAsRead(userId);
  return { message: 'All notifications marked as read' };
}

async function markRead({ id, userId }) {
  await notificationModel.markAsRead(id, userId);
  return { message: 'Notification marked as read' };
}

module.exports = {
  listNotifications,
  markAllRead,
  markRead,
};
