const userModel = require('../models/user.model');
const documentModel = require('../models/document.model');
const chatModel = require('../models/chat.model');
const supabase = require('../config/supabase');
const subjectService = require('./subject.service');
const activityService = require('./activity.service');
const createError = require('../utils/createError');
const { publicUser } = require('./user.service');

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function buildLastSevenDays() {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en', { weekday: 'short' }),
      value: 0,
    };
  });
}

function countByDay(rows, dateField = 'created_at') {
  const days = buildLastSevenDays();
  const byKey = new Map(days.map((day) => [day.key, day]));

  (rows || []).forEach((row) => {
    const key = new Date(row[dateField]).toISOString().slice(0, 10);
    const day = byKey.get(key);
    if (day) day.value += 1;
  });

  return days;
}

function formatActivity(log) {
  const actionLabels = {
    'admin.user.update': 'User account updated',
    'document.upload': 'New document uploaded',
    'bookmark.create': 'Document bookmarked',
    'bookmark.delete': 'Bookmark removed',
    'chat.message': 'AI chat message created',
    'chat.message.send': 'AI chat message created',
    'subject.create': 'Subject created',
  };

  return {
    id: log.id,
    title: actionLabels[log.action] || log.action,
    description: log.target_type ? `${log.target_type}${log.target_id ? ` #${log.target_id}` : ''}` : 'Platform activity',
    created_at: log.created_at,
    action: log.action,
    userEmail: log.users?.email || 'System',
  };
}

async function listUsers() {
  const users = await userModel.findAll();
  return users.map(publicUser);
}

async function getOverview() {
  const since = buildLastSevenDays()[0].key;
  const sinceDate = new Date(`${since}T00:00:00.000Z`);

  const [totalUsers, recentUsers, allDocuments, recentDocuments, aiQueries, logs] = await Promise.all([
    userModel.countAll(),
    userModel.findCreatedSince(sinceDate),
    documentModel.findAllForAdminOverview(),
    documentModel.findAdminOverviewDocuments(sinceDate),
    chatModel.countUserMessages(),
    activityService.listLatest(8),
  ]);

  const documentsProcessed = allDocuments.filter((doc) => {
    return doc.status === 'indexed' || doc.extraction_status === 'ready';
  }).length;
  const systemErrors = allDocuments.filter((doc) => {
    return ['failed', 'empty'].includes(doc.extraction_status);
  }).length;
  const totalStorageBytes = allDocuments.reduce((total, doc) => {
    return total + Number(doc.cloud_files?.size_bytes || 0);
  }, 0);

  const subjectCounts = new Map();
  allDocuments.forEach((doc) => {
    const key = doc.subject_id || 'none';
    const current = subjectCounts.get(key) || {
      id: doc.subject_id || null,
      name: doc.subjects?.name || 'No Subject',
      code: doc.subjects?.code || 'NONE',
      count: 0,
    };
    current.count += 1;
    subjectCounts.set(key, current);
  });

  const maxSubjectCount = Math.max(...Array.from(subjectCounts.values()).map((subject) => subject.count), 0);
  const subjects = Array.from(subjectCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((subject) => ({
      ...subject,
      percentage: maxSubjectCount ? Math.round((subject.count / maxSubjectCount) * 100) : 0,
    }));

  return {
    metrics: {
      totalUsers,
      documentsProcessed,
      aiQueries,
      systemErrors,
      totalStorageBytes,
    },
    charts: {
      userGrowth: countByDay(recentUsers),
      documentUploads: countByDay(recentDocuments),
    },
    subjects,
    recentActivity: logs.map(formatActivity),
  };
}

async function updateUser({ targetUserId, updates, currentUserId }) {
  const dbUpdates = {};

  if (updates.status !== undefined) {
    if (!['active', 'disabled'].includes(updates.status)) {
      throw createError(400, 'Status must be active or disabled');
    }

    if (String(targetUserId) === String(currentUserId) && updates.status === 'disabled') {
      throw createError(400, 'You cannot disable your own account');
    }

    dbUpdates.status = updates.status;
  }

  if (updates.storage_limit_bytes !== undefined) {
    const storageLimit = Number(updates.storage_limit_bytes);
    if (!Number.isInteger(storageLimit) || storageLimit <= 0) {
      throw createError(400, 'Storage limit must be a positive integer');
    }

    dbUpdates.storage_limit_bytes = storageLimit;
  }

  if (!Object.keys(dbUpdates).length) {
    throw createError(400, 'No supported user updates provided');
  }

  dbUpdates.updated_at = new Date().toISOString();

  const user = await userModel.update(targetUserId, dbUpdates);
  if (!user) {
    throw createError(404, 'User not found');
  }

  activityService.log({
    userId: currentUserId,
    action: 'admin.user.update',
    targetType: 'user',
    targetId: user.id,
    metadata: dbUpdates,
  });

  return publicUser(user);
}

async function listDocuments({ search, subjectId, isDeleted } = {}) {
  const { data, error } = await supabase
    .from('documents')
    .select(`
      id,
      title,
      user_id,
      subject_id,
      file_id,
      status,
      created_at,
      updated_at,
      deleted_at,
      users (email),
      subjects (name, code),
      cloud_files (storage_path, mime_type, size_bytes)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  let filtered = data || [];

  if (isDeleted !== undefined && isDeleted !== '') {
    const checkDeleted = String(isDeleted) === 'true';
    filtered = filtered.filter((doc) => (doc.deleted_at !== null) === checkDeleted);
  }

  if (subjectId) {
    filtered = filtered.filter((doc) => Number(doc.subject_id) === Number(subjectId));
  }

  if (search) {
    const term = String(search).trim().toLowerCase();
    filtered = filtered.filter((doc) => {
      const titleMatch = doc.title?.toLowerCase().includes(term);
      const emailMatch = doc.users?.email?.toLowerCase().includes(term);
      const subjectMatch = doc.subjects?.name?.toLowerCase().includes(term) || doc.subjects?.code?.toLowerCase().includes(term);
      return titleMatch || emailMatch || subjectMatch;
    });
  }

  return filtered;
}

module.exports = {
  listUsers,
  getOverview,
  updateUser,
  listDocuments,
  listSubjects: subjectService.listSubjects,
  createSubject: subjectService.createSubject,
  updateSubject: subjectService.updateSubject,
  deleteSubject: subjectService.deleteSubject,
  listActivityLogs: activityService.listLatest,
};
