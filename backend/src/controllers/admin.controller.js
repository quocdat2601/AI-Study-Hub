const adminService = require('../services/admin.service');

/**
 * List all users (Admin)
 */
async function getAllUsers(req, res, next) {
  try {
    res.json(await adminService.listUsers());
  } catch (err) {
    next(err);
  }
}

async function getOverview(req, res, next) {
  try {
    res.json(await adminService.getOverview());
  } catch (err) {
    next(err);
  }
}

/**
 * Update user status or storage limit
 */
async function updateUser(req, res, next) {
  try {
    res.json(await adminService.updateUser({
      targetUserId: req.params.id,
      updates: req.body,
      currentUserId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * List all subjects with document count
 */
async function getAllSubjects(req, res, next) {
  try {
    res.json(await adminService.listSubjects());
  } catch (err) {
    next(err);
  }
}

/**
 * Create subject
 */
async function createSubject(req, res, next) {
  try {
    const subject = await adminService.createSubject({
      ...req.body,
      createdBy: req.user.id,
    });
    res.status(201).json(subject);
  } catch (err) {
    next(err);
  }
}

/**
 * Paginated activity log
 */
async function getActivityLogs(req, res, next) {
  try {
    res.json(await adminService.listActivityLogs(req.query.limit));
  } catch (err) {
    next(err);
  }
}

async function getCommunityReports(req, res, next) {
  try {
    res.json(await adminService.listCommunityReports({
      status: req.query.status,
      limit: req.query.limit,
    }));
  } catch (err) {
    next(err);
  }
}

async function resolveCommunityReport(req, res, next) {
  try {
    res.json(await adminService.resolveCommunityReport({
      reportId: req.params.id,
      adminUserId: req.user.id,
      status: req.body.status,
    }));
  } catch (err) {
    next(err);
  }
}

async function moderateCommunityPost(req, res, next) {
  try {
    res.json(await adminService.moderateCommunityPost({
      postId: req.params.id,
      adminUserId: req.user.id,
      status: req.body.status,
    }));
  } catch (err) {
    next(err);
  }
}

async function moderateCommunityReply(req, res, next) {
  try {
    res.json(await adminService.moderateCommunityReply({
      replyId: req.params.id,
      adminUserId: req.user.id,
      status: req.body.status,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllUsers,
  getOverview,
  updateUser,
  getAllSubjects,
  createSubject,
  getActivityLogs,
  getCommunityReports,
  resolveCommunityReport,
  moderateCommunityPost,
  moderateCommunityReply,
};
