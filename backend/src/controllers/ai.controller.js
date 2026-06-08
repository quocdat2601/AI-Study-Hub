const aiService = require('../services/ai.service');
const aiProviderService = require('../services/ai-provider.service');
const aiUsageService = require('../services/ai-usage.service');

async function processDocument(req, res, next) {
  try {
    res.json(await aiService.processDocument({
      id: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function askDocument(req, res, next) {
  try {
    res.json(await aiService.askDocument({
      id: req.params.id,
      userId: req.user.id,
      question: req.body.question,
      mode: req.body.mode,
      model: req.body.model,
    }));
  } catch (err) {
    next(err);
  }
}

async function getUsage(req, res, next) {
  try {
    res.json(await aiUsageService.getUsage({
      model: req.query.model,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function getModelStatus(req, res, next) {
  try {
    res.json(await aiProviderService.getModelStatus());
  } catch (err) {
    next(err);
  }
}

module.exports = {
  processDocument,
  askDocument,
  getUsage,
  getModelStatus,
};
