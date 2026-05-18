const User = require('../models/user.model');
const Subject = require('../models/subject.model');
const supabase = require('../config/supabase');

/**
 * List all users (Admin)
 */
async function getAllUsers(req, res, next) {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

/**
 * Update user status or storage limit
 */
async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { status, storage_limit_bytes } = req.body;
    const updated = await User.update(id, { status, storage_limit_bytes });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * List all subjects with document count
 */
async function getAllSubjects(req, res, next) {
  try {
    // This would ideally be a more complex query with joins
    const subjects = await Subject.findAll();
    res.json(subjects);
  } catch (err) {
    next(err);
  }
}

/**
 * Create subject
 */
async function createSubject(req, res, next) {
  try {
    const { name, code, description } = req.body;
    const newSubject = await Subject.create({ 
      name, 
      code, 
      description,
      created_by: req.user.id 
    });
    res.status(201).json(newSubject);
  } catch (err) {
    next(err);
  }
}

/**
 * Paginated activity log
 */
async function getActivityLogs(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllUsers,
  updateUser,
  getAllSubjects,
  createSubject,
  getActivityLogs
};
