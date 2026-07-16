const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const announcementModel = require('../src/models/announcement.model');
const notificationModel = require('../src/models/notification.model');
const notificationService = require('../src/services/notification.service');
const supabase = require('../src/config/supabase');

test('Admin Announcements — creation, role filtering, merging notifications, and read Receipts', async (t) => {
  // Mock announcements dataset
  const mockAnnouncements = [
    {
      id: 10,
      title: 'Global System Update',
      message: 'Version 2.0 is live',
      target_role: 'all',
      created_by: 'admin-1',
      created_at: '2026-07-08T12:00:00.000Z',
      announcement_reads: [
        { user_id: 'user-1', read_at: '2026-07-08T12:05:00.000Z' }
      ]
    },
    {
      id: 11,
      title: 'Only Student Notification',
      message: 'Quiz starts tomorrow',
      target_role: 'user',
      created_by: 'admin-1',
      created_at: '2026-07-08T13:00:00.000Z',
      announcement_reads: []
    },
    {
      id: 12,
      title: 'Secret Admin Note',
      message: 'New dashboard controls',
      target_role: 'admin',
      created_by: 'admin-1',
      created_at: '2026-07-08T14:00:00.000Z',
      announcement_reads: []
    }
  ];

  // Mock personal notifications dataset
  const mockNotifications = [
    {
      id: 201,
      user_id: 'user-1',
      type: 'share',
      message: 'Document chemistry.pdf shared with you',
      is_read: false,
      created_at: '2026-07-08T12:30:00.000Z'
    }
  ];

  // Map supabase query chains
  t.mock.method(supabase, 'from', (tableName) => {
    return {
      select: () => {
        return {
          or: (filterString) => {
            return {
              order: () => {
                // Return matched active announcements for user-1 (who has role 'user')
                // This means 'all' and 'user', excluding 'admin' role!
                const matched = mockAnnouncements.filter(a => a.target_role === 'all' || a.target_role === 'user');
                return Promise.resolve({ data: matched, error: null });
              }
            };
          },
          order: () => {
            return {
              limit: () => {
                return Promise.resolve({ data: mockAnnouncements, error: null });
              }
            };
          },
          eq: (column, value) => {
            return {
              order: () => {
                return Promise.resolve({ data: mockNotifications, error: null });
              }
            };
          }
        };
      },
      upsert: (record) => {
        return {
          select: () => {
            return {
              single: () => Promise.resolve({ data: record, error: null })
            };
          }
        };
      }
    };
  });

  // 1. Check findActiveForUser for role filtering and read receipt mapping
  const userAnnouncements = await announcementModel.findActiveForUser({ userId: 'user-1', userRole: 'user' });
  assert.equal(userAnnouncements.length, 2); // 'all' (10) and 'user' (11)

  const activeAll = userAnnouncements.find(a => a.id === 10);
  assert.ok(activeAll);
  assert.equal(activeAll.read_at, '2026-07-08T12:05:00.000Z'); // already read

  const activeUser = userAnnouncements.find(a => a.id === 11);
  assert.ok(activeUser);
  assert.equal(activeUser.read_at, null); // unread

  // 2. Check listNotifications merging personal and announcements
  const listResult = await notificationService.listNotifications('user-1', 'user');
  assert.equal(listResult.notifications.length, 3); // 1 personal + 2 announcements
  assert.equal(listResult.unreadCount, 2); // 1 unread personal + 1 unread announcement

  // Verify descending chronological order
  const ids = listResult.notifications.map(n => n.id);
  // Date sequence: 13:00 (ann-11) -> 12:30 (personal 201) -> 12:00 (ann-10)
  assert.deepEqual(ids, ['ann-11', 201, 'ann-10']);

  // Verify mapped properties
  const quizAnn = listResult.notifications[0];
  assert.equal(quizAnn.type, 'announcement');
  assert.equal(quizAnn.is_read, false);
  assert.equal(quizAnn.message, 'Only Student Notification: Quiz starts tomorrow');

  // 3. Check marking announcement as read by ID prefix
  let markedReadArgs = null;
  t.mock.method(announcementModel, 'markRead', async (args) => {
    markedReadArgs = args;
    return { success: true };
  });

  const markRes = await notificationService.markRead({ id: 'ann-11', userId: 'user-1' });
  assert.equal(markRes.message, 'Announcement marked as read');
  assert.deepEqual(markedReadArgs, { announcementId: 11, userId: 'user-1' });
});
