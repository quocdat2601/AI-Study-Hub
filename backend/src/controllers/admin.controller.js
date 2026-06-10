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

async function getAllDocuments(req, res, next) {
  try {
    res.json(await adminService.listDocuments({
      search: req.query.search,
      subjectId: req.query.subjectId,
      isDeleted: req.query.isDeleted,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Update subject (Admin)
 */
async function updateSubject(req, res, next) {
  try {
    const subject = await adminService.updateSubject(req.params.id, req.body);
    res.json(subject);
  } catch (err) {
    next(err);
  }
}

/**
 * Delete subject (Admin)
 */
async function deleteSubject(req, res, next) {
  try {
    const subject = await adminService.deleteSubject(req.params.id);
    res.json(subject);
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
  updateSubject,
  deleteSubject,
  getActivityLogs,
  getAllDocuments
};
