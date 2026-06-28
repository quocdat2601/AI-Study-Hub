const preferenceService = require('../services/preference.service');

async function getOptions(req, res, next) {
  try {
    res.json(await preferenceService.getOptions(req.user.id));
  } catch (err) {
    next(err);
  }
}

async function getSuggestedTags(req, res, next) {
  try {
    res.json(await preferenceService.getSuggestedTags(req.query.majorId));
  } catch (err) {
    next(err);
  }
}

async function getSubjects(req, res, next) {
  try {
    res.json(await preferenceService.getSubjectsByMajor(req.query.majorId));
  } catch (err) {
    next(err);
  }
}

async function getStatus(req, res, next) {
  try {
    res.json(await preferenceService.getStatus(req.user.id));
  } catch (err) {
    next(err);
  }
}

async function save(req, res, next) {
  try {
    const { majorId, goal, subjects, topics } = req.body;
    res.json(await preferenceService.saveOnboarding(req.user.id, { majorId, goal, subjects, topics }));
  } catch (err) {
    next(err);
  }
}

async function getRecommendations(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 24);
    res.json(await preferenceService.getRecommendations(req.user.id, limit));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOptions,
  getSuggestedTags,
  getSubjects,
  getStatus,
  save,
  getRecommendations,
};
