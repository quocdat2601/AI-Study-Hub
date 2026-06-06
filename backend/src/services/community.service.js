const CommunityModel = require('../models/community.model');
const SubjectModel = require('../models/subject.model');
const NotificationModel = require('../models/notification.model');
const ChatModel = require('../models/chat.model');
const documentService = require('./document.service');
const chatService = require('./chat.service');
const activityService = require('./activity.service');
const createError = require('../utils/createError');

const FEED_LIMIT_MAX = 60;
const POST_TYPES = new Set(['question', 'document_share', 'ai_study_log']);
const FEED_TABS = new Set(['latest', 'trending', 'unanswered', 'solved']);
const POST_STATUSES = new Set(['active', 'hidden', 'removed']);
const REPORT_STATUSES = new Set(['open', 'resolved', 'dismissed']);
const REPLY_STATUSES = new Set(['active', 'hidden', 'removed']);

function normalizeTab(value) {
  const tab = String(value || 'latest').trim().toLowerCase();
  return FEED_TABS.has(tab) ? tab : 'latest';
}

function normalizePostType(value) {
  const postType = String(value || '').trim().toLowerCase();
  return POST_TYPES.has(postType) ? postType : '';
}

function normalizePostStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return POST_STATUSES.has(status) ? status : '';
}

function normalizeReplyStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return REPLY_STATUSES.has(status) ? status : '';
}

function normalizeReportStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return REPORT_STATUSES.has(status) ? status : '';
}

function normalizeLimit(value, fallback = 24) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) return fallback;
  return Math.min(numericValue, FEED_LIMIT_MAX);
}

function normalizeNumericId(value, fieldName) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw createError(400, `${fieldName} is invalid`);
  }
  return numericValue;
}

function requireText(value, fieldName, maxLength) {
  const cleaned = String(value || '').trim();
  if (!cleaned) {
    throw createError(400, `${fieldName} is required`);
  }
  if (maxLength && cleaned.length > maxLength) {
    throw createError(400, `${fieldName} must be ${maxLength} characters or fewer`);
  }
  return cleaned;
}

function displayNameFromEmail(email) {
  const local = String(email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!local) return 'Student';
  return local.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildAuthor(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: displayNameFromEmail(user.email),
    role: user.role,
  };
}

function buildVoteCount(votes) {
  return (votes || []).reduce((total, vote) => total + Number(vote.value || 0), 0);
}

function summarizeText(text, maxChars = 220) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}...`;
}

function buildSentencePreview(text, maxSentences = 3, maxChars = 320) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [];
  const picked = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const next = [...picked, trimmed].join(' ');
    if (next.length > maxChars && picked.length) break;
    picked.push(trimmed);
    if (picked.length >= maxSentences) break;
  }

  const preview = picked.join(' ').trim();
  if (!preview) return summarizeText(normalized, Math.min(maxChars, 220));
  if (preview.length <= maxChars) return preview;
  return `${preview.slice(0, maxChars)}...`;
}

async function notifyUser(userId, message) {
  if (!userId || !message) return;

  try {
    await NotificationModel.create({
      user_id: userId,
      type: 'system',
      message,
    });
  } catch (err) {
    console.error('Notification create failed:', err.message);
  }
}

async function buildDocumentAttachment(document) {
  if (!document) return null;

  const [documentWithThumb] = await documentService.addThumbnailUrls([document]);
  const preview = documentService.buildPublicDocumentPreview(documentWithThumb);

  return {
    id: documentWithThumb.id,
    title: preview.title,
    fileName: preview.title,
    subject: preview.subject,
    subjectCode: preview.subjectCode,
    fileType: preview.fileType,
    fileSizeBytes: preview.fileSizeBytes,
    thumbnailUrl: preview.thumbnailUrl,
    abstractPreview: buildSentencePreview(documentWithThumb.extracted_text),
    previewText: buildSentencePreview(documentWithThumb.extracted_text),
  };
}

async function buildChatAttachment(sessionId, includeMessages = false) {
  if (!sessionId) return null;

  const session = await ChatModel.findSessionById(sessionId);
  if (!session) return null;

  const [documents, messages] = await Promise.all([
    ChatModel.listSessionDocuments(sessionId),
    includeMessages ? ChatModel.getMessages(sessionId) : Promise.resolve([]),
  ]);
  const documentsWithThumb = await documentService.addThumbnailUrls(documents);
  const documentPreviews = documentsWithThumb.map((doc) => ({
    id: doc.id,
    title: doc.title,
    subject: doc.subjects?.name || null,
    subjectCode: doc.subjects?.code || null,
    previewText: summarizeText(doc.extracted_text, 140),
    thumbnailUrl: doc.thumbnailUrl || null,
    fileType: documentService.buildPublicDocumentPreview(doc).fileType,
    isPublic: Boolean(doc.is_public),
  }));

  return {
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      lastActivityAt: session.last_activity_at,
    },
    documents: documentPreviews,
    previewText: summarizeText((messages || []).map((message) => message.content).join(' '), 200) || 'A published AI study session with linked source documents.',
    messages: includeMessages ? messages : undefined,
  };
}

function groupBy(items, key) {
  return (items || []).reduce((map, item) => {
    const value = item[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
    return map;
  }, new Map());
}

async function hydratePosts(posts, options = {}) {
  const includeReplies = Boolean(options.includeReplies);
  const includeFullAttachments = Boolean(options.includeFullAttachments);
  const postIds = (posts || []).map((post) => post.id);
  const replies = await CommunityModel.listRepliesByPostIds(postIds);
  const visibleReplies = replies.filter((reply) => options.includeHiddenReplies || reply.status === 'active');
  const repliesByPostId = groupBy(visibleReplies, 'post_id');
  const replyIds = visibleReplies.map((reply) => reply.id);
  const [postVotes, replyVotes] = await Promise.all([
    CommunityModel.listVotesForPosts(postIds),
    CommunityModel.listVotesForReplies(replyIds),
  ]);
  const postVotesByPostId = groupBy(postVotes, 'post_id');
  const replyVotesByReplyId = groupBy(replyVotes, 'reply_id');

  return Promise.all((posts || []).map(async (post) => {
    const postReplyRows = repliesByPostId.get(post.id) || [];
    const acceptedReply = postReplyRows.find((reply) => reply.id === post.solved_reply_id && reply.status === 'active') || null;
    const mappedReplies = postReplyRows.map((reply) => ({
      id: reply.id,
      postId: reply.post_id,
      body: reply.body,
      status: reply.status,
      isAccepted: Boolean(reply.is_accepted),
      createdAt: reply.created_at,
      updatedAt: reply.updated_at,
      author: buildAuthor(reply.users),
      voteCount: buildVoteCount(replyVotesByReplyId.get(reply.id) || []),
    }));

    const documentAttachment = post.post_type === 'document_share'
      ? await buildDocumentAttachment(post.documents)
      : null;
    const chatAttachment = post.post_type === 'ai_study_log'
      ? await buildChatAttachment(post.chat_session_id, includeFullAttachments)
      : null;

    return {
      id: post.id,
      title: post.title,
      body: post.body,
      excerpt: summarizeText(post.body, 180),
      postType: post.post_type,
      status: post.status,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      subject: post.subjects ? {
        id: post.subjects.id,
        name: post.subjects.name,
        code: post.subjects.code,
      } : null,
      author: buildAuthor(post.users),
      voteCount: buildVoteCount(postVotesByPostId.get(post.id) || []),
      replyCount: mappedReplies.length,
      solved: Boolean(acceptedReply),
      acceptedReplyId: acceptedReply?.id || null,
      documentAttachment,
      chatAttachment,
      replies: includeReplies ? mappedReplies : undefined,
    };
  }));
}

function sortFeed(posts, tab) {
  if (tab === 'latest') {
    return [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  if (tab === 'solved') {
    return posts
      .filter((post) => post.postType === 'question' && post.solved)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }

  if (tab === 'unanswered') {
    return posts
      .filter((post) => post.postType === 'question' && post.replyCount === 0)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return [...posts].sort((a, b) => {
    const scoreDiff = Number(b.voteCount || 0) - Number(a.voteCount || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

async function listPublicFeed({ tab, postType, subjectCode, limit }) {
  const normalizedTab = normalizeTab(tab);
  const normalizedPostType = normalizePostType(postType);
  const normalizedSubjectCode = String(subjectCode || '').trim().toUpperCase();
  const normalizedLimit = normalizeLimit(limit);

  const [posts, subjects] = await Promise.all([
    CommunityModel.listPosts(),
    SubjectModel.listSubjects(),
  ]);

  const subjectByCode = new Map((subjects || []).map((subject) => [subject.code, subject]));
  const activePosts = posts.filter((post) => post.status === 'active');
  let filtered = activePosts;

  if (normalizedPostType) {
    filtered = filtered.filter((post) => post.post_type === normalizedPostType);
  }

  if (normalizedSubjectCode) {
    const subject = subjectByCode.get(normalizedSubjectCode);
    filtered = subject
      ? filtered.filter((post) => Number(post.subject_id) === Number(subject.id))
      : [];
  }

  const hydrated = await hydratePosts(filtered, { includeReplies: false, includeFullAttachments: false });
  return sortFeed(hydrated, normalizedTab).slice(0, normalizedLimit);
}

async function getPublicPostById(id) {
  const postId = normalizeNumericId(id, 'postId');
  const post = await CommunityModel.findPostById(postId);

  if (!post || post.status !== 'active') {
    throw createError(404, 'Community post not found');
  }

  const [hydratedPost] = await hydratePosts([post], {
    includeReplies: true,
    includeFullAttachments: true,
  });

  return hydratedPost;
}

async function listPublicSubjects() {
  const [subjects, posts] = await Promise.all([
    SubjectModel.listSubjects(),
    CommunityModel.listPosts(),
  ]);
  const activePosts = posts.filter((post) => post.status === 'active');
  const counts = activePosts.reduce((map, post) => {
    if (!post.subject_id) return map;
    map.set(post.subject_id, (map.get(post.subject_id) || 0) + 1);
    return map;
  }, new Map());

  return (subjects || []).map((subject) => ({
    id: subject.id,
    name: subject.name,
    code: subject.code,
    postCount: counts.get(subject.id) || 0,
  }));
}

async function ensureSubject(subjectId) {
  if (subjectId == null || subjectId === '') return null;
  const normalizedSubjectId = normalizeNumericId(subjectId, 'subjectId');
  const subjects = await SubjectModel.listSubjects();
  const subject = subjects.find((item) => Number(item.id) === normalizedSubjectId);
  if (!subject) {
    throw createError(404, 'Subject not found');
  }
  return subject;
}

async function createPost({ userId, postType, title, body, subjectId, documentId, chatSessionId }) {
  const normalizedPostType = normalizePostType(postType);
  if (!normalizedPostType) {
    throw createError(400, 'postType is invalid');
  }

  const subject = await ensureSubject(subjectId);
  const cleanedTitle = requireText(title, 'title', 255);
  const cleanedBody = requireText(body, 'body', 5000);
  let normalizedDocumentId = null;
  let normalizedChatSessionId = null;

  if (normalizedPostType === 'document_share') {
    normalizedDocumentId = normalizeNumericId(documentId, 'documentId');
    const document = await documentService.canEditDocument(userId, normalizedDocumentId);
    if (!document) {
      throw createError(404, 'Document not found');
    }
    if (document.status !== 'indexed' || document.extraction_status !== 'ready') {
      throw createError(400, 'Only indexed documents with ready extraction can be shared to community');
    }
    if (!document.is_public) {
      await documentService.updateVisibility({
        id: normalizedDocumentId,
        userId,
        isPublic: true,
      });
    }
  }

  if (normalizedPostType === 'ai_study_log') {
    normalizedChatSessionId = normalizeNumericId(chatSessionId, 'chatSessionId');
    const session = await chatService.canWriteChatSession(userId, normalizedChatSessionId);
    if (!session) {
      throw createError(404, 'Chat session not found');
    }
  }

  let post;
  try {
    post = await CommunityModel.createPost({
      user_id: userId,
      subject_id: subject?.id || null,
      post_type: normalizedPostType,
      title: cleanedTitle,
      body: cleanedBody,
      document_id: normalizedDocumentId,
      chat_session_id: normalizedChatSessionId,
      status: 'active',
    });
  } catch (err) {
    if (err.code === '23505' && normalizedPostType === 'ai_study_log') {
      throw createError(409, 'This chat session already has an active community study log');
    }
    throw err;
  }

  activityService.log({
    userId,
    action: 'community.post.create',
    targetType: 'community_post',
    targetId: post.id,
    metadata: {
      postType: normalizedPostType,
      subjectId: subject?.id || null,
      documentId: normalizedDocumentId,
      chatSessionId: normalizedChatSessionId,
    },
  });

  return getPublicPostById(post.id);
}

async function updatePost({ postId, userId, updates }) {
  const normalizedPostId = normalizeNumericId(postId, 'postId');
  const post = await CommunityModel.findOwnedPostById(normalizedPostId, userId);

  if (!post) {
    throw createError(404, 'Community post not found');
  }

  const nextUpdates = {};
  if (updates.title !== undefined) nextUpdates.title = requireText(updates.title, 'title', 255);
  if (updates.body !== undefined) nextUpdates.body = requireText(updates.body, 'body', 5000);
  if (updates.subjectId !== undefined) {
    const subject = await ensureSubject(updates.subjectId);
    nextUpdates.subject_id = subject?.id || null;
  }

  if (!Object.keys(nextUpdates).length) {
    throw createError(400, 'No supported updates provided');
  }

  await CommunityModel.updatePost(normalizedPostId, nextUpdates);
  activityService.log({
    userId,
    action: 'community.post.update',
    targetType: 'community_post',
    targetId: normalizedPostId,
  });

  return getPublicPostById(normalizedPostId);
}

async function deletePost({ postId, userId }) {
  const normalizedPostId = normalizeNumericId(postId, 'postId');
  const post = await CommunityModel.findOwnedPostById(normalizedPostId, userId);
  if (!post) {
    throw createError(404, 'Community post not found');
  }

  await CommunityModel.deletePost(normalizedPostId);
  activityService.log({
    userId,
    action: 'community.post.delete',
    targetType: 'community_post',
    targetId: normalizedPostId,
    metadata: {
      postType: post.post_type,
    },
  });

  return { message: 'Community post deleted' };
}

async function addReply({ postId, userId, body }) {
  const normalizedPostId = normalizeNumericId(postId, 'postId');
  const post = await CommunityModel.findPostById(normalizedPostId);

  if (!post || post.status !== 'active') {
    throw createError(404, 'Community post not found');
  }

  const reply = await CommunityModel.createReply({
    post_id: normalizedPostId,
    user_id: userId,
    body: requireText(body, 'body', 4000),
    status: 'active',
  });

  await CommunityModel.updatePost(normalizedPostId, {});

  activityService.log({
    userId,
    action: 'community.reply.create',
    targetType: 'community_reply',
    targetId: reply.id,
    metadata: {
      postId: normalizedPostId,
    },
  });

  if (String(post.user_id) !== String(userId)) {
    notifyUser(post.user_id, `New reply on your community post "${post.title}"`);
  }

  return getPublicPostById(normalizedPostId);
}

async function togglePostVote({ postId, userId }) {
  const normalizedPostId = normalizeNumericId(postId, 'postId');
  const post = await CommunityModel.findPostById(normalizedPostId);

  if (!post || post.status !== 'active') {
    throw createError(404, 'Community post not found');
  }

  const existingVote = await CommunityModel.findPostVote(userId, normalizedPostId);
  let voted = false;

  if (existingVote) {
    await CommunityModel.deleteVote(existingVote.id);
  } else {
    await CommunityModel.createVote({
      user_id: userId,
      post_id: normalizedPostId,
      reply_id: null,
      value: 1,
    });
    voted = true;
  }

  activityService.log({
    userId,
    action: voted ? 'community.vote.post.create' : 'community.vote.post.delete',
    targetType: 'community_post',
    targetId: normalizedPostId,
  });

  const [hydrated] = await hydratePosts([post], {
    includeReplies: false,
    includeFullAttachments: false,
  });
  return {
    postId: normalizedPostId,
    voted,
    voteCount: hydrated.voteCount,
  };
}

async function toggleReplyVote({ replyId, userId }) {
  const normalizedReplyId = normalizeNumericId(replyId, 'replyId');
  const reply = await CommunityModel.findReplyById(normalizedReplyId);

  if (!reply || reply.status !== 'active') {
    throw createError(404, 'Community reply not found');
  }

  const existingVote = await CommunityModel.findReplyVote(userId, normalizedReplyId);
  let voted = false;

  if (existingVote) {
    await CommunityModel.deleteVote(existingVote.id);
  } else {
    await CommunityModel.createVote({
      user_id: userId,
      post_id: null,
      reply_id: normalizedReplyId,
      value: 1,
    });
    voted = true;
  }

  activityService.log({
    userId,
    action: voted ? 'community.vote.reply.create' : 'community.vote.reply.delete',
    targetType: 'community_reply',
    targetId: normalizedReplyId,
  });

  const votes = await CommunityModel.listVotesForReplies([normalizedReplyId]);
  return {
    replyId: normalizedReplyId,
    voted,
    voteCount: buildVoteCount(votes),
  };
}

async function acceptReply({ postId, replyId, userId }) {
  const normalizedPostId = normalizeNumericId(postId, 'postId');
  const normalizedReplyId = normalizeNumericId(replyId, 'replyId');
  const post = await CommunityModel.findOwnedPostById(normalizedPostId, userId);

  if (!post || post.status !== 'active') {
    throw createError(404, 'Community post not found');
  }
  if (post.post_type !== 'question') {
    throw createError(400, 'Only question posts can accept a reply');
  }

  const reply = await CommunityModel.findReplyById(normalizedReplyId);
  if (!reply || Number(reply.post_id) !== normalizedPostId || reply.status !== 'active') {
    throw createError(404, 'Community reply not found');
  }

  await CommunityModel.clearAcceptedReplies(normalizedPostId);
  await CommunityModel.updateReply(normalizedReplyId, { is_accepted: true });
  await CommunityModel.updatePost(normalizedPostId, { solved_reply_id: normalizedReplyId });

  activityService.log({
    userId,
    action: 'community.reply.accept',
    targetType: 'community_reply',
    targetId: normalizedReplyId,
    metadata: {
      postId: normalizedPostId,
    },
  });

  if (String(reply.user_id) !== String(userId)) {
    notifyUser(reply.user_id, `Your reply was accepted on "${post.title}"`);
  }

  return getPublicPostById(normalizedPostId);
}

async function reportPost({ postId, replyId, userId, reason }) {
  const normalizedPostId = normalizeNumericId(postId, 'postId');
  const cleanedReason = requireText(reason, 'reason', 600);
  const post = await CommunityModel.findPostById(normalizedPostId);

  if (!post || post.status !== 'active') {
    throw createError(404, 'Community post not found');
  }

  let normalizedReplyId = null;
  if (replyId != null && replyId !== '') {
    normalizedReplyId = normalizeNumericId(replyId, 'replyId');
    const reply = await CommunityModel.findReplyById(normalizedReplyId);
    if (!reply || Number(reply.post_id) !== normalizedPostId) {
      throw createError(404, 'Community reply not found');
    }

    const existingReplyReport = await CommunityModel.findOpenReplyReport(userId, normalizedReplyId);
    if (existingReplyReport) {
      throw createError(409, 'You already have an open report for this reply');
    }
  } else {
    const existingPostReport = await CommunityModel.findOpenPostReport(userId, normalizedPostId);
    if (existingPostReport) {
      throw createError(409, 'You already have an open report for this post');
    }
  }

  let report;
  try {
    report = await CommunityModel.createReport({
      post_id: normalizedReplyId ? null : normalizedPostId,
      reply_id: normalizedReplyId,
      reported_by: userId,
      reason: cleanedReason,
      status: 'open',
    });
  } catch (err) {
    if (err.code === '23505') {
      throw createError(409, 'You already have an open report for this item');
    }
    throw err;
  }

  activityService.log({
    userId,
    action: 'community.report.create',
    targetType: normalizedReplyId ? 'community_reply' : 'community_post',
    targetId: normalizedReplyId || normalizedPostId,
    metadata: {
      reportId: report.id,
    },
  });

  return {
    message: 'Report submitted',
    reportId: report.id,
  };
}

async function listReports({ status, limit }) {
  const normalizedStatus = normalizeReportStatus(status);
  const reports = await CommunityModel.listReports(limit);
  const filtered = normalizedStatus ? reports.filter((report) => report.status === normalizedStatus) : reports;

  return filtered.map((report) => ({
    id: report.id,
    reason: report.reason,
    status: report.status,
    createdAt: report.created_at,
    resolvedAt: report.resolved_at,
    reporter: buildAuthor(report.reporters),
    resolver: buildAuthor(report.resolvers),
    post: report.community_posts ? {
      id: report.community_posts.id,
      title: report.community_posts.title,
      postType: report.community_posts.post_type,
      status: report.community_posts.status,
    } : null,
    reply: report.community_replies ? {
      id: report.community_replies.id,
      postId: report.community_replies.post_id,
      body: summarizeText(report.community_replies.body, 160),
      status: report.community_replies.status,
    } : null,
  }));
}

async function updatePostModeration({ postId, adminUserId, status }) {
  const normalizedPostId = normalizeNumericId(postId, 'postId');
  const normalizedStatus = normalizePostStatus(status);
  if (!normalizedStatus || normalizedStatus === 'active') {
    throw createError(400, 'status must be hidden or removed');
  }

  const post = await CommunityModel.findPostById(normalizedPostId);
  if (!post) {
    throw createError(404, 'Community post not found');
  }

  const updated = await CommunityModel.updatePost(normalizedPostId, { status: normalizedStatus });
  activityService.log({
    userId: adminUserId,
    action: 'community.post.moderate',
    targetType: 'community_post',
    targetId: normalizedPostId,
    metadata: {
      status: normalizedStatus,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
  };
}

async function updateReplyModeration({ replyId, adminUserId, status }) {
  const normalizedReplyId = normalizeNumericId(replyId, 'replyId');
  const normalizedStatus = normalizeReplyStatus(status);
  if (!normalizedStatus || normalizedStatus === 'active') {
    throw createError(400, 'status must be hidden or removed');
  }

  const reply = await CommunityModel.findReplyById(normalizedReplyId);
  if (!reply) {
    throw createError(404, 'Community reply not found');
  }

  await CommunityModel.updateReply(normalizedReplyId, {
    status: normalizedStatus,
    is_accepted: false,
  });

  const post = await CommunityModel.findPostById(reply.post_id);
  if (post && Number(post.solved_reply_id) === normalizedReplyId) {
    await CommunityModel.updatePost(reply.post_id, { solved_reply_id: null });
  }

  activityService.log({
    userId: adminUserId,
    action: 'community.reply.moderate',
    targetType: 'community_reply',
    targetId: normalizedReplyId,
    metadata: {
      status: normalizedStatus,
    },
  });

  return {
    id: normalizedReplyId,
    status: normalizedStatus,
  };
}

async function resolveReport({ reportId, adminUserId, status }) {
  const normalizedReportId = normalizeNumericId(reportId, 'reportId');
  const normalizedStatus = normalizeReportStatus(status);
  if (!normalizedStatus || normalizedStatus === 'open') {
    throw createError(400, 'status must be resolved or dismissed');
  }

  const report = await CommunityModel.updateReport(normalizedReportId, {
    status: normalizedStatus,
    resolved_at: new Date().toISOString(),
    resolved_by: adminUserId,
  });

  if (!report) {
    throw createError(404, 'Community report not found');
  }

  activityService.log({
    userId: adminUserId,
    action: 'community.report.resolve',
    targetType: 'community_report',
    targetId: normalizedReportId,
    metadata: {
      status: normalizedStatus,
    },
  });

  if (report.reported_by) {
    notifyUser(report.reported_by, 'Your community report has been reviewed');
  }

  return {
    id: report.id,
    status: report.status,
    resolvedAt: report.resolved_at,
  };
}

async function listTopContributors(limit = 5) {
  const posts = await CommunityModel.listPosts();
  const activePosts = posts.filter((post) => post.status === 'active');
  const hydratedPosts = await hydratePosts(activePosts, { includeReplies: true, includeFullAttachments: false });
  const contributors = new Map();

  hydratedPosts.forEach((post) => {
    if (post.author?.id) {
      const current = contributors.get(post.author.id) || {
        ...post.author,
        score: 0,
      };
      current.score += Math.max(0, post.voteCount);
      contributors.set(post.author.id, current);
    }

    (post.replies || []).forEach((reply) => {
      if (!reply.author?.id) return;
      const current = contributors.get(reply.author.id) || {
        ...reply.author,
        score: 0,
      };
      current.score += Math.max(0, reply.voteCount);
      if (reply.isAccepted) current.score += 3;
      contributors.set(reply.author.id, current);
    });
  });

  return [...contributors.values()]
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
    .slice(0, Math.max(1, Number(limit) || 5));
}

async function getCommunityHome({ tab, postType, subjectCode, limit }) {
  const [feed, subjects, topContributors] = await Promise.all([
    listPublicFeed({ tab, postType, subjectCode, limit }),
    listPublicSubjects(),
    listTopContributors(5),
  ]);

  return {
    feed,
    subjects,
    topContributors,
  };
}

module.exports = {
  getCommunityHome,
  listPublicFeed,
  getPublicPostById,
  listPublicSubjects,
  createPost,
  updatePost,
  deletePost,
  addReply,
  togglePostVote,
  toggleReplyVote,
  acceptReply,
  reportPost,
  listReports,
  updatePostModeration,
  updateReplyModeration,
  resolveReport,
};
