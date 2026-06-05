const publicService = require('../services/public.service');

async function getTrendingDocuments(req, res, next) {
  try {
    const documents = await publicService.getTrendingDocuments(req.query.limit);
    res.json(documents);
  } catch (error) {
    next(error);
  }
}

async function getPublicChatShare(req, res, next) {
  try {
    res.json(await publicService.getPublicChatShare(req.params.token));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTrendingDocuments,
  getPublicChatShare,
};
