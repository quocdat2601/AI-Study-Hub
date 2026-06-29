const subjectService = require('../services/subject.service');

/**
 * List all subjects
 */
async function getAllSubjects(req, res, next) {
  try {
    res.json(await subjectService.listSubjects());
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllSubjects
};
