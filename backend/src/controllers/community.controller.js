const crypto = require('crypto');
const supabase = require('../config/supabase');
const communityService = require('../services/community.service');

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payloadJson);
  } catch (_) {
    return null;
  }
}

async function buildOptionalViewerContext(req) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    const payload = decodeJwtPayload(token);
    if (payload && payload.exp && Date.now() < payload.exp * 1000) {
      try {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user?.id) {
          return {
            userId: data.user.id,
            viewerKey: `user:${data.user.id}`,
          };
        }
      } catch (_) {
        // Fall through to guest fingerprinting for public access.
      }
    }
  }

  const forwardedFor = Array.isArray(req.headers['x-forwarded-for'])
    ? req.headers['x-forwarded-for'][0]
    : String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';
  const userAgent = String(req.headers['user-agent'] || 'unknown');
  const acceptLanguage = String(req.headers['accept-language'] || '');
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${ip}|${userAgent}|${acceptLanguage}`)
    .digest('hex');

  return {
    viewerKey: `guest:${fingerprint}`,
  };
}

async function getHome(req, res, next) {
  try {
    const viewerContext = await buildOptionalViewerContext(req);
    res.json(await communityService.getCommunityHome({
      tab: req.query.tab,
      postType: req.query.postType,
      subjectCode: req.query.subject,
      limit: req.query.limit,
      viewerContext,
    }));
  } catch (err) {
    next(err);
  }
}

async function getFeed(req, res, next) {
  try {
    const viewerContext = await buildOptionalViewerContext(req);
    res.json(await communityService.listPublicFeed({
      tab: req.query.tab,
      postType: req.query.postType,
      subjectCode: req.query.subject,
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
      await buildOptionalViewerContext(req),
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
  createPost,
  updatePost,
  deletePost,
  addReply,
  deleteReply,
  votePost,
  voteReply,
  acceptReply,
  reportPost,
};
