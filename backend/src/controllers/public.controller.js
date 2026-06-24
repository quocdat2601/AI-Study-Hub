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

async function searchPublicDocuments(req, res, next) {
  try {
    const { search, subjectId, sortBy, page, limit } = req.query;
    const result = await publicService.searchPublicDocuments({
      search,
      subjectId: subjectId ? Number(subjectId) : null,
      sortBy,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 12,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getPublicDocumentById(req, res, next) {
  try {
    const document = await publicService.getPublicDocumentById(req.params.id);
    res.json(document);
  } catch (error) {
    next(error);
  }
}

async function getPublicDocumentSignedUrl(req, res, next) {
  try {
    const result = await publicService.getPublicDocumentSignedUrl(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function listDocumentComments(req, res, next) {
  try {
    const comments = await publicService.listDocumentComments(req.params.id);
    res.json(comments);
  } catch (error) {
    next(error);
  }
}

async function createDocumentComment(req, res, next) {
  try {
    const { content, rating } = req.body;
    const comment = await publicService.createDocumentComment({
      docId: req.params.id,
      userId: req.user.id,
      content,
      rating: rating ? Number(rating) : null,
    });
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTrendingDocuments,
  getPublicChatShare,
  searchPublicDocuments,
  getPublicDocumentById,
  getPublicDocumentSignedUrl,
  listDocumentComments,
  createDocumentComment,
};
