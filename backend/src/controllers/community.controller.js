const communityService = require('../services/community.service');

async function getHome(req, res, next) {
  try {
    res.json(await communityService.getCommunityHome({
      tab: req.query.tab,
      postType: req.query.postType,
      subjectCode: req.query.subject,
      limit: req.query.limit,
    }));
  } catch (err) {
    next(err);
  }
}

async function getFeed(req, res, next) {
  try {
    res.json(await communityService.listPublicFeed({
      tab: req.query.tab,
      postType: req.query.postType,
      subjectCode: req.query.subject,
      limit: req.query.limit,
    }));
  } catch (err) {
    next(err);
  }
}

async function getPostById(req, res, next) {
  try {
    res.json(await communityService.getPublicPostById(req.params.id));
  } catch (err) {
    next(err);
  }
}

async function getSubjects(req, res, next) {
  try {
    res.json(await communityService.listPublicSubjects());
  } catch (err) {
    next(err);
  }
}

async function createPost(req, res, next) {
  try {
    res.status(201).json(await communityService.createPost({
      userId: req.user.id,
      postType: req.body.postType,
      title: req.body.title,
      body: req.body.body,
      subjectId: req.body.subjectId,
      documentId: req.body.documentId,
      chatSessionId: req.body.chatSessionId,
    }));
  } catch (err) {
    next(err);
  }
}

async function updatePost(req, res, next) {
  try {
    res.json(await communityService.updatePost({
      postId: req.params.id,
      userId: req.user.id,
      updates: req.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    res.json(await communityService.deletePost({
      postId: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function addReply(req, res, next) {
  try {
    res.status(201).json(await communityService.addReply({
      postId: req.params.id,
      userId: req.user.id,
      body: req.body.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function votePost(req, res, next) {
  try {
    res.json(await communityService.togglePostVote({
      postId: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function voteReply(req, res, next) {
  try {
    res.json(await communityService.toggleReplyVote({
      replyId: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function acceptReply(req, res, next) {
  try {
    res.json(await communityService.acceptReply({
      postId: req.params.id,
      replyId: req.params.replyId,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function reportPost(req, res, next) {
  try {
    res.status(201).json(await communityService.reportPost({
      postId: req.params.id,
      replyId: req.body.replyId,
      userId: req.user.id,
      reason: req.body.reason,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHome,
  getFeed,
  getPostById,
  getSubjects,
  createPost,
  updatePost,
  deletePost,
  addReply,
  votePost,
  voteReply,
  acceptReply,
  reportPost,
};
