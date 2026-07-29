const CommunityModel = require('../models/community.model');
const SubjectModel = require('../models/subject.model');
const NotificationModel = require('../models/notification.model');
const ChatModel = require('../models/chat.model');
const documentService = require('./document.service');
const chatService = require('./chat.service');
const activityService = require('./activity.service');
const supabaseService = require('./supabase.service');
const createError = require('../utils/createError');

const POST_TYPES = new Set(['discussion', 'question', 'document_share', 'ai_study_log']);
const FEED_TABS = new Set(['latest', 'trending', 'unanswered', 'solved']);
const POST_STATUSES = new Set(['active', 'hidden', 'removed']);
const REPORT_STATUSES = new Set(['open', 'resolved', 'dismissed']);
const REPLY_STATUSES = new Set(['active', 'hidden', 'removed']);
const POST_SUBJECT_LIMIT = 3;
const POST_VIEW_WINDOW_MINUTES = 30;

// =========================================================================
// SECTION 1: NORMALIZATION & VALIDATION HELPERS
// Small pure helper functions to parse, validate, and constrain fields like
// post tab modes, statuses, subject limits, emails, and numeric IDs.
// =========================================================================

/**
 * Normalizes user feed tab selection to a valid tab type.
 * @param {string} value - Selected tab value.
 * @returns {string} Normalized tab.
 */
function normalizeTab(value) {
  const tab = String(value || 'latest').trim().toLowerCase();
  return FEED_TABS.has(tab) ? tab : 'latest';
}

/**
 * Normalizes community post type filters.
 * @param {string} value - Raw post type string.
 * @returns {string} Normalized post type or empty string.
 */
function normalizePostType(value) {
  const postType = String(value || '').trim().toLowerCase();
  return POST_TYPES.has(postType) ? postType : '';
}

/**
 * Normalizes post visibility statuses.
 * @param {string} value - Post status string.
 * @returns {string} Normalized status.
 */
function normalizePostStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return POST_STATUSES.has(status) ? status : '';
}

/**
 * Normalizes reply visibility statuses.
 * @param {string} value - Reply status string.
 * @returns {string} Normalized reply status.
 */
function normalizeReplyStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return REPLY_STATUSES.has(status) ? status : '';
}

/**
 * Normalizes moderation report statuses.
 * @param {string} value - Report status string.
 * @returns {string} Normalized report status.
 */
function normalizeReportStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return REPORT_STATUSES.has(status) ? status : '';
}

/**
 * Validates and normalizes numeric IDs to integers greater than zero.
 * @param {any} value - Raw ID value.
 * @param {string} fieldName - Label name for error messages.
 * @returns {number} Normalized integer ID.
 */
function normalizeNumericId(value, fieldName) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw createError(400, `${fieldName} is invalid`);
  }
  return numericValue;
}

/**
 * Requires text value presence and checks string length limitations.
 * @param {any} value - Input value.
 * @param {string} fieldName - Label name for errors.
 * @param {number} [maxLength] - Optional maximum character limit.
 * @returns {string} Cleaned trimmed string.
 */
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

/**
 * Requires text value presence and asserts string length bounds.
 * @param {any} value - Input value.
 * @param {string} fieldName - Label name for errors.
 * @param {object} bounds - Range parameters.
 * @param {number} [bounds.minLength] - Min character count.
 * @param {number} [bounds.maxLength] - Max character count.
 * @returns {string} Cleaned string.
 */
function requireTextWithBounds(value, fieldName, { minLength, maxLength } = {}) {
  const cleaned = requireText(value, fieldName, maxLength);

  if (minLength && cleaned.length < minLength) {
    throw createError(400, `${fieldName} must be at least ${minLength} characters`);
  }

  return cleaned;
}

/**
 * Groups and validates multiple subject IDs down to target limits.
 * @param {Array|number} subjectIds - Array of subject IDs.
 * @param {number} [subjectId] - Singular subject ID fallback.
 * @returns {Array<number>} Cleaned list of unique subject IDs.
 */
function normalizeSubjectIds(subjectIds, subjectId) {
  const rawValues = Array.isArray(subjectIds)
    ? subjectIds
    : subjectIds != null
      ? [subjectIds]
      : subjectId != null
        ? [subjectId]
        : [];

  const normalizedIds = [...new Set(
    rawValues
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
      .map((value) => normalizeNumericId(value, 'subjectId'))
  )];

  if (normalizedIds.length > POST_SUBJECT_LIMIT) {
    throw createError(400, `subjectIds must contain ${POST_SUBJECT_LIMIT} subjects or fewer`);
  }

  return normalizedIds;
}

/**
 * Formulates user display name from their registered email when display name is null.
 * @param {string} email - Registered email string.
 * @returns {string} Generated display name.
 */
function displayNameFromEmail(email) {
  const local = String(email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!local) return 'Student';
  return local.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// =========================================================================
// SECTION 2: ATTACHMENT & AUTHOR BUILDERS
// Helper logic to assemble author statistics/metadata, generate secure S3/Supabase
// storage assets paths, and build document/chat share link parameters.
// =========================================================================

/**
 * Signs and retrieves public access paths for Supabase storage avatar assets.
 * @param {string} avatarPath - Supabase storage asset location string.
 * @param {Map} [cache] - Performance cache storage reference.
 * @returns {Promise<string|null>} Signed URL string or null.
 */
async function resolveAvatarUrl(avatarPath, cache = null) {
  const normalizedPath = String(avatarPath || '').trim();
  if (!normalizedPath) return null;

  if (cache?.has(normalizedPath)) {
    return cache.get(normalizedPath);
  }

  try {
    const signedUrl = await supabaseService.getSignedUrl(normalizedPath, 3600);
    if (cache) cache.set(normalizedPath, signedUrl);
    return signedUrl;
  } catch {
    if (cache) cache.set(normalizedPath, null);
    return null;
  }
}

/**
 * Standardizes user object fields into UI-friendly author schemas.
 * @param {object} user - Raw database user record.
 * @param {Map} [statsByUserId] - Map of user stats profiles.
 * @param {Map} [avatarUrlCache] - Cache reference for paths.
 * @returns {Promise<object|null>} Hydrated author schema or null.
 */
async function buildAuthor(user, statsByUserId = null, avatarUrlCache = null) {
  if (!user) return null;
  const stats = statsByUserId?.get(String(user.id)) || null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || displayNameFromEmail(user.email),
    role: user.role,
    createdAt: user.created_at || null,
    avatarUrl: await resolveAvatarUrl(user.avatar_path, avatarUrlCache),
    postCount: stats?.postCount || 0,
    utilityPoints: stats?.utilityPoints || 0,
  };
}

/**
 * Computes net vote score by summing individual active vote values.
 * @param {Array} votes - Array of vote records.
 * @returns {number} Net score sum.
 */
function buildVoteCount(votes) {
  return (votes || []).reduce((total, vote) => total + Number(vote.value || 0), 0);
}

/**
 * Summarizes text segments for previews by replacing whitespace and slicing to maximum counts.
 * @param {string} text - Raw input text.
 * @param {number} [maxChars] - Slicing target length.
 * @returns {string} Truncated string.
 */
function summarizeText(text, maxChars = 220) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}...`;
}

/**
 * Generates natural paragraph abstracts by picking full sentences within limits.
 * @param {string} text - Raw document string.
 * @param {number} [maxSentences] - Max sentence boundary count limit.
 * @param {number} [maxChars] - Slice length guard.
 * @returns {string} Natural summary preview.
 */
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

/**
 * Records a database notification trace for the user.
 * @param {string} userId - Recipient ID reference.
 * @param {string} type - Notification label type.
 * @param {string} message - Content message.
 * @param {number} [refPostId] - Optional reference post database identifier.
 * @returns {Promise<void>}
 */
async function notify(userId, type, message, refPostId = null) {
  if (!userId || !message) return;

  try {
    await NotificationModel.create({
      user_id: userId,
      type,
      message,
      ref_post_id: refPostId,
    });
  } catch (err) {
    console.error('Notification create failed:', err.message);
  }
}

/**
 * Packages shared document assets into standardized community preview shapes.
 * @param {object} document - Raw document database record.
 * @returns {Promise<object|null>} Attachable document model schema.
 */
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

/**
 * Structures detailed chat session attachments including linked files and message excerpts.
 * @param {number} sessionId - Target chat session ID.
 * @param {boolean} [includeMessages] - Load full dialog transcript list.
 * @returns {Promise<object|null>} Structured chat thread metadata.
 */
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

/**
 * Checks and fetches valid subject records, throwing errors if inputs map to nonexistent assets.
 * @param {Array<number>} subjectIds - Collection of target IDs.
 * @param {number} [subjectId] - Singular candidate fallback.
 * @returns {Promise<Array<object>>} Collection of subject database records.
 */
async function ensureSubjects(subjectIds, subjectId) {
  const normalizedSubjectIds = normalizeSubjectIds(subjectIds, subjectId);
  if (!normalizedSubjectIds.length) {
    return [];
  }

  const subjects = await SubjectModel.listSubjects();
  const subjectById = new Map((subjects || []).map((subject) => [Number(subject.id), subject]));

  return normalizedSubjectIds.map((id) => {
    const subject = subjectById.get(Number(id));
    if (!subject) {
      throw createError(404, 'Subject not found');
    }
    return subject;
  });
}

/**
 * Standard utility function to group arrays of object nodes by target key names.
 * @param {Array} items - List of items.
 * @param {string} key - Object key property name.
 * @returns {Map} Grouped map mapping values to collections.
 */
function groupBy(items, key) {
  return (items || []).reduce((map, item) => {
    const value = item[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
    return map;
  }, new Map());
}

// =========================================================================
// SECTION 3: HYDRATION HELPERS
// Functions in this section batch-fetch associated author profile statistics,
// linked subjects, reply trees, vote flags, and document/chat attachments to
// build final unified post objects for frontend consumers.
// =========================================================================

/**
 * Batches stats profiles from view statistics tables to inject post counts and utility scores.
 * @param {Array<object>} posts - Active posts.
 * @param {Array<object>} replies - Active replies.
 * @param {object} [options] - Configurations options.
 * @param {boolean} [options.includeAuthorStats] - Include stats in output.
 * @returns {Promise<Map>} Map of user stats profiles.
 */
async function buildAuthorStatsByUserId(posts, replies, options = {}) {
  if (!options.includeAuthorStats) {
    return new Map();
  }

  const targetUserIds = [...new Set(
    [
      ...(posts || []).map((post) => post?.user_id || post?.users?.id),
      ...(replies || []).map((reply) => reply?.user_id || reply?.users?.id),
    ]
      .filter(Boolean)
      .map((value) => String(value))
  )];

  if (!targetUserIds.length) {
    return new Map();
  }

  const supabase = require('../config/supabase');
  const { data, error } = await supabase
    .from('community_user_stats')
    .select('id, post_count, reply_count, utility_points')
    .in('id', targetUserIds);

  if (error) throw error;

  const statsByUserId = new Map();
  targetUserIds.forEach((userId) => {
    statsByUserId.set(userId, {
      postCount: 0,
      utilityPoints: 0,
    });
  });

  (data || []).forEach((row) => {
    const key = String(row.id);
    statsByUserId.set(key, {
      postCount: Number(row.post_count || 0) + Number(row.reply_count || 0),
      utilityPoints: Number(row.utility_points || 0),
    });
  });

  return statsByUserId;
}

/**
 * Resolves all subjects linked to a community post.
 * @param {object} post - Post database record.
 * @param {Map} subjectLinksByPostId - Map of post-subject junctions.
 * @returns {Array<object>} Resolved subjects details list.
 */
function mapLinkedSubjects(post, subjectLinksByPostId) {
  const linkedSubjects = (subjectLinksByPostId.get(post.id) || [])
    .map((link) => link.subjects ? ({
      id: link.subjects.id,
      name: link.subjects.name,
      code: link.subjects.code,
    }) : null)
    .filter(Boolean);

  if (linkedSubjects.length) {
    return linkedSubjects;
  }

  if (post.subjects?.id) {
    return [{
      id: post.subjects.id,
      name: post.subjects.name,
      code: post.subjects.code,
    }];
  }

  return [];
}

/**
 * Resolves child relations (authors, replies, votes, attachments) of raw posts array.
 * @param {Array<object>} posts - Raw posts array.
 * @param {object} [options] - Hydration filters.
 * @param {boolean} [options.includeReplies] - Include full replies tree.
 * @param {boolean} [options.includeFullAttachments] - Include chat log messages lists.
 * @param {boolean} [options.includeAuthorStats] - Include user utility points.
 * @param {string|number} [options.viewerUserId] - User ID viewing the feed to flag votes.
 * @returns {Promise<Array<object>>} Hydrated posts.
 */
async function hydratePosts(posts, options = {}) {
  const includeReplies = Boolean(options.includeReplies);
  const includeFullAttachments = Boolean(options.includeFullAttachments);
  const viewerUserId = options.viewerUserId ? String(options.viewerUserId) : '';
  const postIds = (posts || []).map((post) => post.id);
  const replies = await CommunityModel.listRepliesByPostIds(postIds);
  const subjectLinks = await CommunityModel.listPostSubjectLinksByPostIds(postIds);
  const visibleReplies = replies.filter((reply) => options.includeHiddenReplies || reply.status === 'active');
  const repliesByPostId = groupBy(visibleReplies, 'post_id');
  const subjectLinksByPostId = groupBy(subjectLinks, 'post_id');
  const replyIds = visibleReplies.map((reply) => reply.id);
  const [postVotes, replyVotes] = await Promise.all([
    CommunityModel.listVotesForPosts(postIds),
    CommunityModel.listVotesForReplies(replyIds),
  ]);
  const postVotesByPostId = groupBy(postVotes, 'post_id');
  const replyVotesByReplyId = groupBy(replyVotes, 'reply_id');
  const viewerPostVoteIds = viewerUserId
    ? new Set(
      (postVotes || [])
        .filter((vote) => String(vote.user_id) === viewerUserId && Number(vote.value) > 0)
        .map((vote) => Number(vote.post_id))
    )
    : new Set();
  const viewerReplyVoteIds = viewerUserId
    ? new Set(
      (replyVotes || [])
        .filter((vote) => String(vote.user_id) === viewerUserId && Number(vote.value) > 0)
        .map((vote) => Number(vote.reply_id))
    )
    : new Set();
  const authorStatsByUserId = await buildAuthorStatsByUserId(posts, visibleReplies, options);
  const avatarUrlCache = new Map();

  return Promise.all((posts || []).map(async (post) => {
    const postReplyRows = repliesByPostId.get(post.id) || [];
    const replyById = new Map(postReplyRows.map((reply) => [Number(reply.id), reply]));
    const acceptedReply = postReplyRows.find((reply) => reply.id === post.solved_reply_id && reply.status === 'active') || null;
    const latestReply = [...postReplyRows].sort((a, b) => {
      const left = new Date(a.updated_at || a.created_at || 0).getTime();
      const right = new Date(b.updated_at || b.created_at || 0).getTime();
      return right - left;
    })[0] || null;
    const mappedReplies = await Promise.all(postReplyRows.map(async (reply) => ({
      id: reply.id,
      postId: reply.post_id,
      parentReplyId: reply.parent_reply_id || null,
      parentReply: reply.parent_reply_id ? await (async () => {
        const parentReply = replyById.get(Number(reply.parent_reply_id));
        if (!parentReply || parentReply.status !== 'active') return null;

        return {
          id: parentReply.id,
          author: await buildAuthor(parentReply.users, authorStatsByUserId, avatarUrlCache),
          excerpt: summarizeText(parentReply.body, 140),
        };
      })() : null,
      body: reply.body,
      status: reply.status,
      isAccepted: Boolean(reply.is_accepted),
      createdAt: reply.created_at,
      updatedAt: reply.updated_at,
      author: await buildAuthor(reply.users, authorStatsByUserId, avatarUrlCache),
      voteCount: buildVoteCount(replyVotesByReplyId.get(reply.id) || []),
      isUpvoted: viewerReplyVoteIds.has(Number(reply.id)),
    })));

    const documentAttachment = post.post_type === 'document_share'
      ? await buildDocumentAttachment(post.documents)
      : null;
    const chatAttachment = post.post_type === 'ai_study_log'
      ? await buildChatAttachment(post.chat_session_id, includeFullAttachments)
      : null;
    const linkedSubjects = mapLinkedSubjects(post, subjectLinksByPostId);
    const primarySubject = linkedSubjects[0] || null;

    return {
      id: post.id,
      title: post.title,
      body: post.body,
      excerpt: summarizeText(post.body, 180),
      postType: post.post_type,
      status: post.status,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      subject: primarySubject,
      subjects: linkedSubjects,
      author: await buildAuthor(post.users, authorStatsByUserId, avatarUrlCache),
      lastActivity: latestReply ? {
        at: latestReply.updated_at || latestReply.created_at,
        replyId: latestReply.id,
        user: await buildAuthor(latestReply.users, authorStatsByUserId, avatarUrlCache),
      } : {
        at: post.updated_at || post.created_at,
        replyId: null,
        user: await buildAuthor(post.users, authorStatsByUserId, avatarUrlCache),
      },
      voteCount: buildVoteCount(postVotesByPostId.get(post.id) || []),
      isUpvoted: viewerPostVoteIds.has(Number(post.id)),
      viewCount: Number(post.view_count || 0),
      replyCount: mappedReplies.length,
      solved: Boolean(acceptedReply),
      acceptedReplyId: acceptedReply?.id || null,
      documentAttachment,
      chatAttachment,
      replies: includeReplies ? mappedReplies : undefined,
    };
  }));
}


// =========================================================================
// SECTION 4: PUBLIC FEED & BROWSING OPERATIONS
// Methods in this section support public read access to community posts, feeds,
// active subjects directories, and filtered searches.
// =========================================================================

/**
 * Lists and filters posts inside the public feed using tabs, subject codes, searches, and pagination.
 * @param {object} params
 * @param {'latest'|'trending'|'unanswered'|'solved'} params.tab - Active category feed tab.
 * @param {string} [params.postType] - Post type filter.
 * @param {string} [params.subjectCode] - Code descriptor for linked subject.
 * @param {string} [params.search] - Case-insensitive search text query.
 * @param {number} [params.page] - Target page index (1-based).
 * @param {number} [params.pageSize] - Slicing window size count (limit 50).
 * @param {object} [params.viewerContext] - Viewer metadata context (userId).
 * @returns {Promise<object>} Paginated feed result containing hydrated posts lists.
 */
async function listPublicFeed({ tab, postType, subjectCode, search, page, pageSize, viewerContext = {} }) {
  const normalizedTab = normalizeTab(tab);
  const normalizedPostType = normalizePostType(postType);
  const normalizedSubjectCode = String(subjectCode || '').trim().toUpperCase();
  const normalizedPage = Math.max(1, Number.isInteger(Number(page)) ? Number(page) : 1);
  const normalizedPageSize = Math.min(50, Math.max(1, Number.isInteger(Number(pageSize)) ? Number(pageSize) : 15));
  const normalizedSearch = String(search || '').trim().toLowerCase();

  const supabase = require('../config/supabase');

  let query = supabase
    .from('community_posts_feed_view')
    .select('post_id', { count: 'exact' })
    .eq('status', 'active');

  if (normalizedPostType) {
    query = query.eq('post_type', normalizedPostType);
  }

  if (normalizedSubjectCode) {
    const { data: matchingSubjects } = await supabase
      .from('subjects')
      .select('id')
      .eq('code', normalizedSubjectCode);

    if (matchingSubjects && matchingSubjects.length > 0) {
      const subjectIds = matchingSubjects.map((s) => s.id);
      const { data: junctionLinks } = await supabase
        .from('community_post_subjects')
        .select('post_id')
        .in('subject_id', subjectIds);
      const linkedPostIds = (junctionLinks || []).map((link) => link.post_id);

      if (linkedPostIds.length > 0) {
        query = query.or(`subject_id.in.(${subjectIds.join(',')}),post_id.in.(${linkedPostIds.join(',')})`);
      } else {
        query = query.in('subject_id', subjectIds);
      }
    } else {
      return { posts: [], total: 0, page: normalizedPage, pageSize: normalizedPageSize, totalPages: 1 };
    }
  }

  if (normalizedSearch) {
    const { data: searchedSubjects } = await supabase
      .from('subjects')
      .select('id')
      .or(`name.ilike.%${normalizedSearch}%,code.ilike.%${normalizedSearch}%`);

    const searchedSubjectIds = (searchedSubjects || []).map((s) => s.id);
    let searchedJunctionPostIds = [];
    if (searchedSubjectIds.length > 0) {
      const { data: searchedJunctionLinks } = await supabase
        .from('community_post_subjects')
        .select('post_id')
        .in('subject_id', searchedSubjectIds);
      searchedJunctionPostIds = (searchedJunctionLinks || []).map((link) => link.post_id);
    }

    const searchOrParts = [
      `title.ilike.%${normalizedSearch}%`,
      `body.ilike.%${normalizedSearch}%`,
    ];
    if (searchedSubjectIds.length > 0) {
      searchOrParts.push(`subject_id.in.(${searchedSubjectIds.join(',')})`);
    }
    if (searchedJunctionPostIds.length > 0) {
      searchOrParts.push(`post_id.in.(${searchedJunctionPostIds.join(',')})`);
    }
    query = query.or(searchOrParts.join(','));
  }

  if (normalizedTab === 'solved') {
    query = query
      .eq('post_type', 'question')
      .not('solved_reply_id', 'is', null)
      .order('updated_at', { ascending: false });
  } else if (normalizedTab === 'unanswered') {
    query = query
      .eq('post_type', 'question')
      .eq('reply_count', 0)
      .order('created_at', { ascending: false });
  } else if (normalizedTab === 'trending') {
    query = query
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const start = (normalizedPage - 1) * normalizedPageSize;
  const end = start + normalizedPageSize - 1;
  const { data: feedIds, count: total, error } = await query.range(start, end);

  if (error) throw error;

  const totalPages = Math.max(1, Math.ceil((total || 0) / normalizedPageSize));

  if (!feedIds || !feedIds.length) {
    return { posts: [], total: total || 0, page: normalizedPage, pageSize: normalizedPageSize, totalPages };
  }

  const targetPostIds = feedIds.map((row) => row.post_id);
  const postsData = await CommunityModel.findPostsByIds(targetPostIds);
  const postsMap = new Map((postsData || []).map((p) => [p.id, p]));
  const sortedPosts = targetPostIds.map((id) => postsMap.get(id)).filter(Boolean);

  const posts_page = await hydratePosts(sortedPosts, {
    includeReplies: false,
    includeFullAttachments: false,
    viewerUserId: viewerContext.userId || null,
  });

  return { posts: posts_page, total: total || 0, page: normalizedPage, pageSize: normalizedPageSize, totalPages };
}

/**
 * Fetches a single public post by its database ID, tracks the viewer session (views count), and hydrates full threads.
 * @param {number|string} id - Post database ID.
 * @param {object} [viewerContext] - Context reference of viewing user.
 * @returns {Promise<object>} Hydrated post thread.
 */
async function getPublicPostById(id, viewerContext = {}) {
  const postId = normalizeNumericId(id, 'postId');
  let post = await CommunityModel.findPostById(postId);

  if (!post || post.status !== 'active') {
    throw createError(404, 'Community post not found');
  }

  const viewerKey = String(viewerContext.viewerKey || '').trim();
  if (viewerKey) {
    await CommunityModel.trackPostView(postId, viewerKey, POST_VIEW_WINDOW_MINUTES);
    post = await CommunityModel.findPostById(postId);
  }

  const [hydratedPost] = await hydratePosts([post], {
    includeReplies: true,
    includeFullAttachments: true,
    includeAuthorStats: true,
    viewerUserId: viewerContext.userId || null,
  });

  return hydratedPost;
}

/**
 * Fetches list of active academic subjects decorated with their community posts counts.
 * @returns {Promise<Array<object>>} Decorated subjects list.
 */
async function listPublicSubjects() {
  const supabase = require('../config/supabase');
  const [subjects, countsResult, docRowsResult] = await Promise.all([
    SubjectModel.listSubjects(),
    supabase.from('community_subject_post_counts').select('*'),
    supabase
      .from('documents')
      .select('subject_id')
      .eq('is_public', true)
      .eq('document_scope', 'library')
      .eq('lifecycle_status', 'active')
      .eq('status', 'indexed')
      .is('deleted_at', null)
  ]);

  if (countsResult.error) throw countsResult.error;
  if (docRowsResult.error) throw docRowsResult.error;

  const countsMap = new Map((countsResult.data || []).map((row) => [row.subject_id, row.post_count]));
  const docCountsMap = new Map();
  (docRowsResult.data || []).forEach((row) => {
    if (row.subject_id) {
      docCountsMap.set(row.subject_id, (docCountsMap.get(row.subject_id) || 0) + 1);
    }
  });

  return (subjects || []).map((subject) => ({
    id: subject.id,
    name: subject.name,
    code: subject.code,
    postCount: Number(countsMap.get(subject.id) || 0),
    docCount: Number(docCountsMap.get(subject.id) || 0),
  }));
}

// =========================================================================
// SECTION 5: MEMBER ACTIONS: CREATE, UPDATE & DELETE POSTS/REPLIES
// Operations in this section allow authorized members to create, edit, delete
// or attach resource indexes to posts and threaded replies.
// =========================================================================

/**
 * Inserts a new community post into the database.
 * Handles attachment validations for sharing files or private study sessions logs.
 * @param {object} params
 * @param {string} params.userId - Author user ID reference.
 * @param {string} params.postType - Category classification.
 * @param {string} params.title - Post header.
 * @param {string} params.body - Detailed post description body text.
 * @param {Array<number>} [params.subjectIds] - Associated tags.
 * @param {number} [params.subjectId] - Singular fallback tag.
 * @param {number} [params.documentId] - Shared file attachment.
 * @param {number} [params.chatSessionId] - Attached AI dialog trace.
 * @returns {Promise<object>} Hydrated newly created post thread object.
 */
async function createPost({ userId, postType, title, body, subjectIds, subjectId, documentId, chatSessionId }) {
  const normalizedPostType = normalizePostType(postType);
  if (!normalizedPostType) {
    throw createError(400, 'postType is invalid');
  }

  const resolvedSubjects = await ensureSubjects(subjectIds, subjectId);
  const cleanedTitle = requireTextWithBounds(title, 'title', {
    minLength: 10,
    maxLength: 255,
  });
  const cleanedBody = requireTextWithBounds(body, 'body', {
    minLength: 20,
    maxLength: 5000,
  });
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
      subject_id: resolvedSubjects[0]?.id || null,
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

  await CommunityModel.replacePostSubjects(post.id, resolvedSubjects.map((subject) => subject.id));

  activityService.log({
    userId,
    action: 'community.post.create',
    targetType: 'community_post',
    targetId: post.id,
    metadata: {
      postType: normalizedPostType,
      subjectIds: resolvedSubjects.map((subject) => subject.id),
      documentId: normalizedDocumentId,
      chatSessionId: normalizedChatSessionId,
    },
  });

  return getPublicPostById(post.id);
}

/**
 * Updates properties of an owned community post record.
 * @param {object} params
 * @param {number|string} params.postId - Target post ID.
 * @param {string} params.userId - Request owner credentials check.
 * @param {object} params.updates - Updated properties map.
 * @param {string} [params.updates.title] - New title text.
 * @param {string} [params.updates.body] - New body text content.
 * @param {Array<number>} [params.updates.subjectIds] - Associated tags.
 * @param {number} [params.updates.subjectId] - Singular tag fallback.
 * @returns {Promise<object>} Hydrated updated post thread.
 */
async function updatePost({ postId, userId, updates }) {
  const normalizedPostId = normalizeNumericId(postId, 'postId');
  const post = await CommunityModel.findOwnedPostById(normalizedPostId, userId);

  if (!post) {
    throw createError(404, 'Community post not found');
  }

  const nextUpdates = {};
  if (updates.title !== undefined) nextUpdates.title = requireText(updates.title, 'title', 255);
  if (updates.body !== undefined) nextUpdates.body = requireText(updates.body, 'body', 5000);
  const hasSubjectUpdates = updates.subjectIds !== undefined || updates.subjectId !== undefined;
  const resolvedSubjects = hasSubjectUpdates
    ? await ensureSubjects(updates.subjectIds, updates.subjectId)
    : null;
  if (resolvedSubjects) nextUpdates.subject_id = resolvedSubjects[0]?.id || null;

  if (!Object.keys(nextUpdates).length) {
    throw createError(400, 'No supported updates provided');
  }

  await CommunityModel.updatePost(normalizedPostId, nextUpdates);
  if (resolvedSubjects) {
    await CommunityModel.replacePostSubjects(normalizedPostId, resolvedSubjects.map((subject) => subject.id));
  }
  activityService.log({
    userId,
    action: 'community.post.update',
    targetType: 'community_post',
    targetId: normalizedPostId,
    metadata: resolvedSubjects ? { subjectIds: resolvedSubjects.map((subject) => subject.id) } : undefined,
  });

  return getPublicPostById(normalizedPostId);
}

/**
 * Deletes a community post record.
 * @param {object} params
 * @param {number|string} params.postId - Target post ID.
 * @param {string} params.userId - Owner user ID validation reference.
 * @returns {Promise<{message: string}>} Result string payload status.
 */
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

/**
 * Deletes a reply record if request credentials match author profiles.
 * @param {object} params
 * @param {number|string} params.replyId - Target reply ID reference.
 * @param {string} params.userId - Client identity ID reference.
 * @returns {Promise<object>} Hydrated parent post thread.
 */
async function deleteReply({ replyId, userId }) {
  const normalizedReplyId = normalizeNumericId(replyId, 'replyId');
  const reply = await CommunityModel.findReplyById(normalizedReplyId);

  if (!reply || reply.status !== 'active' || String(reply.user_id) !== String(userId)) {
    throw createError(404, 'Community reply not found');
  }

  await CommunityModel.deleteReply(normalizedReplyId);

  const post = await CommunityModel.findPostById(reply.post_id);
  if (post && Number(post.solved_reply_id) === normalizedReplyId) {
    await CommunityModel.updatePost(reply.post_id, { solved_reply_id: null });
  }

  activityService.log({
    userId,
    action: 'community.reply.delete',
    targetType: 'community_reply',
    targetId: normalizedReplyId,
    metadata: {
      postId: reply.post_id,
    },
  });

  return getPublicPostById(reply.post_id);
}

/**
 * Edits the textual content of a reply.
 * @param {object} params
 * @param {number|string} params.replyId - Target reply ID.
 * @param {string} params.userId - Creator authorization check.
 * @param {string} params.body - New body content.
 * @returns {Promise<object>} Hydrated parent post thread.
 */
async function editReply({ replyId, userId, body }) {
  const normalizedReplyId = normalizeNumericId(replyId, 'replyId');
  const reply = await CommunityModel.findReplyById(normalizedReplyId);

  if (!reply || reply.status !== 'active' || String(reply.user_id) !== String(userId)) {
    throw createError(404, 'Community reply not found');
  }

  const cleanedBody = requireText(body, 'body', 4000);
  await CommunityModel.updateReply(normalizedReplyId, { body: cleanedBody });

  activityService.log({
    userId,
    action: 'community.reply.edit',
    targetType: 'community_reply',
    targetId: normalizedReplyId,
    metadata: { postId: reply.post_id },
  });

  return getPublicPostById(reply.post_id);
}

/**
 * Inserts a new reply (comment or nested child reply) under a community thread.
 * Sends notifications to thread authors or parent reply authors.
 * @param {object} params
 * @param {number|string} params.postId - Target post ID.
 * @param {string} params.userId - Author ID reference.
 * @param {string} params.body - Reply comment text content.
 * @param {number|string} [params.parentReplyId] - Associated parent reply ID.
 * @returns {Promise<object>} Hydrated parent post thread.
 */
async function addReply({ postId, userId, body, parentReplyId }) {
  const normalizedPostId = normalizeNumericId(postId, 'postId');
  const post = await CommunityModel.findPostById(normalizedPostId);

  if (!post || post.status !== 'active') {
    throw createError(404, 'Community post not found');
  }

  const normalizedParentReplyId = parentReplyId != null && parentReplyId !== ''
    ? normalizeNumericId(parentReplyId, 'parentReplyId')
    : null;
  let parentReply = null;

  if (normalizedParentReplyId) {
    parentReply = await CommunityModel.findReplyById(normalizedParentReplyId);
    if (!parentReply || Number(parentReply.post_id) !== normalizedPostId || parentReply.status !== 'active') {
      throw createError(404, 'Parent reply not found');
    }
  }

  const reply = await CommunityModel.createReply({
    post_id: normalizedPostId,
    user_id: userId,
    parent_reply_id: normalizedParentReplyId,
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
      parentReplyId: normalizedParentReplyId,
    },
  });

  if (String(post.user_id) !== String(userId)) {
    await notify(post.user_id, 'community_reply', `Someone replied to your post "${post.title}"`, normalizedPostId);
  }

  if (parentReply && String(parentReply.user_id) !== String(userId)) {
    await notify(parentReply.user_id, 'community_reply', `Someone replied to your comment on "${post.title}"`, normalizedPostId);
  }

  return getPublicPostById(normalizedPostId);
}

// =========================================================================
// SECTION 6: MEMBER ACTIONS: VOTING & SOLUTIONS
// Allows community members to upvote/downvote posts/comments and mark specific replies
// as the accepted answer/solution for question threads.
// =========================================================================

/**
 * Toggles user upvote status for a post. If already upvoted, the vote is deleted.
 * @param {object} params
 * @param {number|string} params.postId - Target post ID.
 * @param {string} params.userId - Voter user ID reference.
 * @returns {Promise<object>} Upvote toggled status and updated vote counts.
 */
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

  if (voted && String(post.user_id) !== String(userId)) {
    await notify(post.user_id, 'community_upvote', `Someone upvoted your post "${post.title}"`, normalizedPostId);
  }

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

/**
 * Toggles user upvote status for a reply comment.
 * @param {object} params
 * @param {number|string} params.replyId - Target reply ID.
 * @param {string} params.userId - Voter user ID reference.
 * @returns {Promise<object>} Toggled vote state properties.
 */
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

  if (voted && String(reply.user_id) !== String(userId)) {
    const post = await CommunityModel.findPostById(reply.post_id);
    if (post) {
      await notify(reply.user_id, 'community_upvote', `Someone upvoted your reply on "${post.title}"`, reply.post_id);
    }
  }

  const votes = await CommunityModel.listVotesForReplies([normalizedReplyId]);
  return {
    replyId: normalizedReplyId,
    voted,
    voteCount: buildVoteCount(votes),
  };
}

/**
 * Marks a single comment reply as the verified/accepted solution to a question.
 * @param {object} params
 * @param {number|string} params.postId - Target parent post ID.
 * @param {number|string} params.replyId - Target reply ID solution.
 * @param {string} params.userId - Post author ID credentials verification.
 * @returns {Promise<object>} Hydrated updated post thread.
 */
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
    await notify(reply.user_id, 'community_accepted', `Your reply was accepted as the answer on "${post.title}"`, normalizedPostId);
  }

  return getPublicPostById(normalizedPostId);
}

// =========================================================================
// SECTION 7: MODERATION QUEUE & REPORT OPERATIONS
// Support moderation routines like user reporting (posts/comments flags)
// and admin reviews / updates for hidden or deleted posts.
// =========================================================================

/**
 * Files an open abuse report/flag against a community post or comment reply.
 * @param {object} params
 * @param {number|string} params.postId - Associated post ID.
 * @param {number|string} [params.replyId] - Associated reply ID.
 * @param {string} params.userId - Submitting user ID.
 * @param {string} params.reason - Detailed abuse description reason.
 * @returns {Promise<object>} Status report payload details.
 */
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

/**
 * Lists user reports filtered by status and counts.
 * @param {object} params
 * @param {string} [params.status] - Status filter category.
 * @param {number} [params.limit] - Max limit query count.
 * @returns {Promise<Array<object>>} Collection of parsed reports.
 */
async function listReports({ status, limit }) {
  const normalizedStatus = normalizeReportStatus(status);
  const reports = await CommunityModel.listReports(limit);
  const filtered = normalizedStatus ? reports.filter((report) => report.status === normalizedStatus) : reports;

  return Promise.all(filtered.map(async (report) => ({
    id: report.id,
    reason: report.reason,
    status: report.status,
    createdAt: report.created_at,
    resolvedAt: report.resolved_at,
    reporter: await buildAuthor(report.reporters, null, new Map()),
    resolver: await buildAuthor(report.resolvers, null, new Map()),
    post: report.community_posts ? {
      id: report.community_posts.id,
      title: report.community_posts.title,
      body: report.community_posts.body,
      postType: report.community_posts.post_type,
      status: report.community_posts.status,
    } : null,
    reply: report.community_replies ? {
      id: report.community_replies.id,
      postId: report.community_replies.post_id,
      body: summarizeText(report.community_replies.body, 160),
      status: report.community_replies.status,
      postTitle: report.community_replies.community_posts?.title || report.community_replies['community_posts!community_replies_post_id_fkey']?.title,
    } : null,
  })));
}

/**
 * Administrative method to updates status filters (hides, flags, approves) for posts.
 * @param {object} params
 * @param {number|string} params.postId - Target post ID.
 * @param {string} params.adminUserId - Moderator user ID credentials.
 * @param {string} params.status - New moderation target status string.
 * @returns {Promise<object>} Status metadata properties.
 */
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
  
  const resolvedReports = await CommunityModel.resolveOpenReportsForPost(normalizedPostId, adminUserId);
  for (const r of resolvedReports) {
    if (r.reported_by) {
      await notify(r.reported_by, 'system', 'Your community report has been reviewed');
    }
  }

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

/**
 * Administrative method to update moderation status of a reply.
 * @param {object} params
 * @param {number|string} params.replyId - Target reply ID reference.
 * @param {string} params.adminUserId - Admin credentials user ID.
 * @param {string} params.status - Moderate action status target string.
 * @returns {Promise<object>} Moderated reply properties.
 */
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

  const resolvedReports = await CommunityModel.resolveOpenReportsForReply(normalizedReplyId, adminUserId);
  for (const r of resolvedReports) {
    if (r.reported_by) {
      await notify(r.reported_by, 'system', 'Your community report has been reviewed');
    }
  }

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

/**
 * Administrative action to resolve open reports queue items.
 * @param {object} params
 * @param {number|string} params.reportId - Target report ID record.
 * @param {string} params.adminUserId - Resolver admin user ID.
 * @param {'resolved'|'dismissed'} params.status - Resolution classification status.
 * @returns {Promise<object>} Updated report model reference.
 */
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
    await notify(report.reported_by, 'system', 'Your community report has been reviewed');
  }

  return {
    id: report.id,
    status: report.status,
    resolvedAt: report.resolved_at,
  };
}

// =========================================================================
// SECTION 8: STATS, PROFILE & HOME AGGREGATIONS
// Operations to fetch list of top contributors (utility points hierarchy),
// user profiles stats counters, and standard homepage summaries feed dashboard payload.
// =========================================================================

/**
 * Lists the top contributors ordered descending by their utility points counters.
 * @param {number} [limit] - Max result collection count (default 5).
 * @returns {Promise<Array<object>>} Top contributors list.
 */
async function listTopContributors(limit = 5) {
  const supabase = require('../config/supabase');
  const { data, error } = await supabase
    .from('community_user_stats')
    .select('*')
    .gt('utility_points', 0)
    .order('utility_points', { ascending: false })
    .order('display_name', { ascending: true })
    .limit(Math.max(1, Number(limit) || 5));

  if (error) throw error;

  const userIds = [...new Set((data || []).map((row) => String(row.id)).filter(Boolean))];
  const avatarUrlByUserId = new Map();
  const avatarPathCache = new Map();

  if (userIds.length) {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, avatar_path')
      .in('id', userIds);

    if (userError) throw userError;

    await Promise.all((users || []).map(async (user) => {
      const avatarUrl = await resolveAvatarUrl(user.avatar_path, avatarPathCache);
      avatarUrlByUserId.set(String(user.id), avatarUrl);
    }));
  }

  return (data || []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name || displayNameFromEmail(row.email),
    role: row.role,
    createdAt: row.created_at,
    avatarUrl: avatarUrlByUserId.get(String(row.id)) || null,
    postCount: Number(row.post_count || 0) + Number(row.reply_count || 0),
    utilityPoints: Number(row.utility_points || 0),
    score: Number(row.utility_points || 0),
  }));
}

/**
 * Aggregates statistics counts, profile user information, and recent post feeds for community profile pages.
 * @param {number|string} userId - Target profile owner ID.
 * @returns {Promise<object>} Aggregated profile information map.
 */
async function getUserCommunityProfile(userId) {
  const normalizedUserId = normalizeNumericId(userId, 'userId');
  const userPosts = await CommunityModel.listActivePostsByUserId(normalizedUserId);

  const hydratedPosts = await hydratePosts(userPosts, {
    includeReplies: false,
    includeFullAttachments: false,
  });

  const author = hydratedPosts[0]?.author || null;

  if (!author && userPosts.length === 0) {
    throw createError(404, 'User not found or has no community activity');
  }

  const totalVotesReceived = hydratedPosts.reduce((sum, p) => sum + Math.max(0, p.voteCount || 0), 0);

  const recentPosts = hydratedPosts
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  return {
    user: author,
    stats: {
      postCount: hydratedPosts.length,
      totalVotesReceived,
      utilityPoints: author?.utilityPoints || totalVotesReceived,
    },
    recentPosts,
  };
}

/**
 * Aggregates homepage data feeds containing active user lists, public subject tags list, and paginated feed list.
 * @param {object} params
 * @param {'latest'|'trending'|'unanswered'|'solved'} params.tab - Selected feed tab mode.
 * @param {string} [params.postType] - Post classification.
 * @param {string} [params.subjectCode] - Linked academic subject code.
 * @param {string} [params.search] - Case-insensitive filter search.
 * @param {number} [params.page] - Target page offset index.
 * @param {number} [params.pageSize] - Feed counts page size.
 * @param {object} [params.viewerContext] - Client user credentials check.
 * @returns {Promise<object>} Aggregate community dashboard payload data map.
 */
async function getCommunityHome({ tab, postType, subjectCode, search, page, pageSize, viewerContext = {} }) {
  const [feedResult, subjects, topContributors] = await Promise.all([
    listPublicFeed({ tab, postType, subjectCode, search, page, pageSize, viewerContext }),
    listPublicSubjects(),
    listTopContributors(5),
  ]);

  return {
    feed: feedResult.posts,
    total: feedResult.total,
    page: feedResult.page,
    pageSize: feedResult.pageSize,
    totalPages: feedResult.totalPages,
    subjects,
    topContributors,
  };
}

module.exports = {
  getCommunityHome,
  listPublicFeed,
  getUserCommunityProfile,
  getPublicPostById,
  listPublicSubjects,
  createPost,
  updatePost,
  deletePost,
  editReply,
  deleteReply,
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
