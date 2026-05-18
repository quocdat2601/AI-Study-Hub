const Subject = require('../models/subject.model');

/**
 * List all subjects
 */
async function getAllSubjects(req, res, next) {
  try {
    const subjects = await Subject.findAll();
    res.json(subjects);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllSubjects
};
