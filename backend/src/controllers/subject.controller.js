const subjectService = require('../services/subject.service');

async function listSubjects(req, res, next) {
  try {
    const subjects = await subjectService.listSubjects();
    res.json({ subjects });
  } catch (err) {
    next(err);
  }
}

async function createSubject(req, res, next) {
  try {
    const subject = await subjectService.createSubject({
      ...req.body,
      createdBy: req.user.id,
    });
    res.status(201).json({ subject });
  } catch (err) {
    next(err);
  }
}

async function updateSubject(req, res, next) {
  try {
    const subject = await subjectService.updateSubject(req.params.id, req.body);
    res.json({ subject });
  } catch (err) {
    next(err);
  }
}

async function deleteSubject(req, res, next) {
  try {
    await subjectService.deleteSubject(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
};
