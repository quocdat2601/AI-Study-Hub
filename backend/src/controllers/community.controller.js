const communityService = require('../services/community.service');
const buildViewerContext = require('../utils/buildViewerContext');

async function getHome(req, res, next) {
  try {
    const viewerContext = await buildViewerContext(req);
    res.json(await communityService.getCommunityHome({
      tab: req.query.tab,
      postType: req.query.postType,
      subjectCode: req.query.subject,
      search: req.query.search,
      page: req.query.page,
      pageSize: req.query.pageSize,
      viewerContext,
    }));
  } catch (err) {
    next(err);
  }
}

async function getFeed(req, res, next) {
  try {
    const viewerContext = await buildViewerContext(req);
    res.json(await communityService.listPublicFeed({
      tab: req.query.tab,
      postType: req.query.postType,
      subjectCode: req.query.subject,
      search: req.query.search,
      page: req.query.page,
      pageSize: req.query.pageSize,
      limit: req.query.limit,
      viewerContext,
    }));
  } catch (err) {
    next(err);
  }
}

async function getPostById(req, res, next) {
  try {
    res.json(await communityService.getPublicPostById(
      req.params.id,
      await buildViewerContext(req),
    ));
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

async function getUserProfile(req, res, next) {
  try {
    res.json(await communityService.getUserCommunityProfile(req.params.userId));
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
      subjectIds: req.body.subjectIds,
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
      parentReplyId: req.body.parentReplyId,
    }));
  } catch (err) {
    next(err);
  }
}

async function editReply(req, res, next) {
  try {
    res.json(await communityService.editReply({
      replyId: req.params.id,
      userId: req.user.id,
      body: req.body.body,
    }));
  } catch (err) {
    next(err);
  }
}

async function deleteReply(req, res, next) {
  try {
    res.json(await communityService.deleteReply({
      replyId: req.params.id,
      userId: req.user.id,
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
  getUserProfile,
  createPost,
  updatePost,
  deletePost,
  addReply,
  editReply,
  deleteReply,
  votePost,
  voteReply,
  acceptReply,
  reportPost,
};
