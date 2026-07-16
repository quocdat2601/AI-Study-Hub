const notificationModel = require('../models/notification.model');
const userModel = require('../models/user.model');
const announcementModel = require('../models/announcement.model');

async function listNotifications(userId, userRole = 'user') {
  const [personal, announcements] = await Promise.all([
    notificationModel.findByUserId(userId),
    announcementModel.findActiveForUser({ userId, userRole }),
  ]);

  const announcementItems = announcements.map(a => ({
    id: `ann-${a.id}`,
    type: 'announcement',
    message: `${a.title}: ${a.message}`,
    is_read: !!a.read_at,
    created_at: a.created_at,
  }));

  const merged = [...personal, ...announcementItems]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return { notifications: merged, unreadCount: merged.filter(n => !n.is_read).length };
}

async function markAllRead(userId) {
  await notificationModel.markAllAsRead(userId);
  return { message: 'All notifications marked as read' };
}

async function markRead({ id, userId }) {
  if (String(id).startsWith('ann-')) {
    const announcementId = Number(id.replace('ann-', ''));
    await announcementModel.markRead({ announcementId, userId });
    return { message: 'Announcement marked as read' };
  }
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
