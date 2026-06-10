const notificationModel = require('../models/notification.model');
const userModel = require('../models/user.model');

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

async function notifyAdmins({ type = 'system', message, refDocId = null }) {
  try {
    const users = await userModel.findAll();
    const admins = users.filter((u) => u.role === 'admin');

    await Promise.all(
      admins.map((admin) =>
        notificationModel.create({
          userId: admin.id,
          type,
          message,
          refDocId,
        })
      )
    );
  } catch (err) {
    console.error('Failed to notify admins:', err.message);
  }
}

module.exports = {
  listNotifications,
  markAllRead,
  markRead,
  notifyAdmins,
};
