import { getSafeNumber, getSafeText, pickArray, pickObject } from "./communityUtils.js";

function normalizeRoleBadges(authorSource = {}) {
  const explicitBadges = authorSource.roleBadges || authorSource.role_badges || authorSource.badges;

  if (Array.isArray(explicitBadges)) {
    return explicitBadges
      .map((badge) => {
        if (!badge) return null;
        if (typeof badge === "string") return { label: badge, tone: "slate" };

        const label = getSafeText(badge.label || badge.name || badge.title || badge.role);
        if (!label) return null;

        return {
          label,
          tone: getSafeText(badge.tone || badge.color || badge.variant, "slate"),
        };
      })
      .filter(Boolean);
  }

  const role = getSafeText(authorSource.role);
  if (!role) return [];

  return [
    {
      label: role === "admin" ? "Admin" : role === "moderator" ? "Moderator" : role === "user" ? "Student" : role,
      tone: role === "admin" ? "violet" : role === "moderator" ? "blue" : "slate",
    },
  ];
}

function normalizeAuthor(rawRecord = {}) {
  const authorSource = pickObject(
    rawRecord.author,
    rawRecord.users,
    rawRecord.user,
    rawRecord.created_by_user,
    rawRecord.owner,
    rawRecord.account,
    rawRecord.profile
  );

  const email = getSafeText(authorSource.email || rawRecord.author_email);
  const displayName = getSafeText(
    authorSource.displayName
      || authorSource.display_name
      || authorSource.full_name
      || authorSource.name
      || rawRecord.author_name
  ) || (email ? email.split("@")[0] : "Anonymous user");

  return {
    id: authorSource.id || rawRecord.user_id || rawRecord.author_id || rawRecord.created_by || null,
    displayName,
    avatarUrl: getSafeText(
      authorSource.avatarUrl
        || authorSource.avatar_url
        || authorSource.profile_photo_url
        || authorSource.photo_url
        || authorSource.image_url
        || rawRecord.author_avatar_url
    ),
    email,
    roleBadges: normalizeRoleBadges(authorSource),
    joinedAt: authorSource.createdAt || authorSource.created_at || authorSource.joined_at || rawRecord.author_joined_at || null,
    postCount: authorSource.postCount || authorSource.post_count || authorSource.posts_count || authorSource.total_posts || rawRecord.author_post_count || 0,
    utilityPoints: authorSource.utilityPoints || authorSource.utility_points || authorSource.points || authorSource.reputation || rawRecord.author_utility_points || 0,
    href: getSafeText(authorSource.href || authorSource.profileHref || authorSource.profile_url),
  };
}

function normalizeAttachmentPayload(rawRecord = {}) {
  return pickObject(
    rawRecord.attachmentPayload,
    rawRecord.attachment_payload,
    rawRecord.attachment,
    rawRecord.documentAttachment,
    rawRecord.chatAttachment,
    rawRecord.document_share,
    rawRecord.document,
    rawRecord.shared_document,
    rawRecord.study_log,
    rawRecord.ai_study_log,
    rawRecord.metadata
  );
}

function normalizeSubject(rawRecord = {}) {
  const subjectSource = pickObject(rawRecord.subject, rawRecord.subjects);
  return {
    id: subjectSource.id || rawRecord.subject_id || null,
    code: getSafeText(subjectSource.code || rawRecord.subject_code),
    name: getSafeText(subjectSource.name || rawRecord.subject_name),
  };
}

function normalizeSubjects(rawRecord = {}) {
  if (Array.isArray(rawRecord.subjects)) {
    return rawRecord.subjects
      .map((subject) => ({
        id: subject?.id || null,
        code: getSafeText(subject?.code),
        name: getSafeText(subject?.name),
      }))
      .filter((subject) => subject.id || subject.code || subject.name);
  }

  const primarySubject = normalizeSubject(rawRecord);
  return primarySubject.id || primarySubject.code || primarySubject.name ? [primarySubject] : [];
}

function normalizeCategory(rawRecord = {}, replyCount = 0) {
  const postType = getSafeText(rawRecord.postType || rawRecord.post_type || rawRecord.type, "question");
  const solved = Boolean(rawRecord.solved || rawRecord.isSolved || rawRecord.is_solved);

  if (postType === "discussion") {
    return { label: "Discussion", tone: "slate" };
  }

  if (postType === "document_share") {
    return { label: "Document", tone: "amber" };
  }

  if (postType === "ai_study_log") {
    return { label: "AI Study Log", tone: "violet" };
  }

  if (solved) {
    return { label: "Solved", tone: "emerald" };
  }

  if (replyCount === 0) {
    return { label: "Unanswered", tone: "blue" };
  }

  return { label: "Question", tone: "indigo" };
}

function normalizeMetrics(rawRecord = {}, repliesCountFromArray = null) {
  const metricsSource = pickObject(rawRecord.metrics, rawRecord.stat, rawRecord.stats);
  const replyCount = repliesCountFromArray ?? getSafeNumber(
    rawRecord.replyCount
      || rawRecord.reply_count
      || rawRecord.replies_count
      || rawRecord.comments_count
      || metricsSource.replyCount
      || metricsSource.reply_count
      || metricsSource.replies
      || 0
  );
  const voteCount = getSafeNumber(
    rawRecord.voteCount
      || rawRecord.upvoteCount
      || rawRecord.upvote_count
      || rawRecord.upvotes_count
      || rawRecord.vote_count
      || metricsSource.voteCount
      || metricsSource.upvoteCount
      || metricsSource.upvote_count
      || metricsSource.votes
      || 0
  );

  return {
    upvoteCount: voteCount,
    voteCount,
    replyCount,
    viewCount: getSafeNumber(
      rawRecord.viewCount
        || rawRecord.view_count
        || rawRecord.views_count
        || metricsSource.viewCount
        || metricsSource.view_count
        || metricsSource.views
        || 0
    ),
  };
}

function normalizeLastActivity(rawRecord = {}, author = null) {
  const lastActivitySource = pickObject(rawRecord.lastActivity, rawRecord.last_activity, rawRecord.activity);
  const userSource = pickObject(lastActivitySource.user, lastActivitySource.users, lastActivitySource.author);
  const fallbackAuthor = author || normalizeAuthor(rawRecord);

  return {
    at: lastActivitySource.at || lastActivitySource.createdAt || lastActivitySource.created_at || lastActivitySource.updated_at || rawRecord.updatedAt || rawRecord.updated_at || rawRecord.createdAt || rawRecord.created_at || null,
    userName: getSafeText(
      userSource.displayName
        || userSource.display_name
        || userSource.full_name
        || userSource.name
        || lastActivitySource.user_name,
      fallbackAuthor.displayName
    ),
    email: getSafeText(userSource.email, fallbackAuthor.email),
    avatarUrl: getSafeText(
      userSource.avatarUrl
        || userSource.avatar_url
        || userSource.profile_photo_url
        || lastActivitySource.avatar_url,
      fallbackAuthor.avatarUrl
    ),
    href: getSafeText(lastActivitySource.href || lastActivitySource.url || userSource.profile_url, fallbackAuthor.href),
  };
}

function buildAttachmentSummary(postType, rawRecord = {}) {
  if (postType === "document_share") {
    const title = getSafeText(
      rawRecord.documentAttachment?.title
        || rawRecord.documentAttachment?.fileName
        || rawRecord.attachmentPayload?.title
        || rawRecord.attachmentPayload?.fileName
    );
    if (!title) return "";
    return `Document: ${title}`;
  }

  if (postType === "ai_study_log") {
    const title = getSafeText(
      rawRecord.chatAttachment?.session?.title
        || rawRecord.attachmentPayload?.session?.title
        || rawRecord.attachmentPayload?.title
    );
    if (!title) return "";
    return `Session: ${title}`;
  }

  return "";
}

function summarizeExcerpt(rawRecord = {}, content) {
  const explicitExcerpt = getSafeText(rawRecord.excerpt || rawRecord.previewText || rawRecord.preview_text);
  if (explicitExcerpt) return explicitExcerpt;
  const normalized = getSafeText(content).replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 180)}...`;
}

export function normalizeThreadPost(rawRecord = {}, index = 1) {
  const content = getSafeText(rawRecord.content || rawRecord.body || rawRecord.reply_text || rawRecord.message, "No content yet.");
  const author = normalizeAuthor(rawRecord);
  const metrics = normalizeMetrics(rawRecord, Array.isArray(rawRecord.replies) ? rawRecord.replies.length : null);
  const postType = getSafeText(rawRecord.postType || rawRecord.post_type || rawRecord.type, "question");
  const attachmentSummary = buildAttachmentSummary(postType, rawRecord);
  const subjects = normalizeSubjects(rawRecord);

  return {
    id: rawRecord.id || rawRecord.reply_id || rawRecord.post_id || `community-item-${index}`,
    index,
    href: rawRecord.id || rawRecord.post_id ? `/community/posts/${rawRecord.id || rawRecord.post_id}` : "",
    title: getSafeText(rawRecord.title || rawRecord.post_title || rawRecord.subject),
    content,
    excerpt: summarizeExcerpt(rawRecord, content),
    createdAt: rawRecord.createdAt || rawRecord.created_at || rawRecord.inserted_at || rawRecord.published_at || null,
    updatedAt: rawRecord.updatedAt || rawRecord.updated_at || rawRecord.modified_at || null,
    author,
    subject: subjects[0] || { id: null, code: "", name: "" },
    subjects,
    metrics,
    category: normalizeCategory(rawRecord, metrics.replyCount),
    lastActivity: normalizeLastActivity(rawRecord, author),
    postType,
    solved: Boolean(rawRecord.solved || rawRecord.isSolved || rawRecord.is_solved),
    isAccepted: Boolean(rawRecord.isAccepted || rawRecord.is_accepted),
    acceptedReplyId: rawRecord.acceptedReplyId || rawRecord.accepted_reply_id || null,
    attachmentPayload: normalizeAttachmentPayload(rawRecord),
    attachmentSummary,
    documentAttachment: rawRecord.documentAttachment || null,
    chatAttachment: rawRecord.chatAttachment || null,
  };
}

export function getDetailPost(rawDetail) {
  const candidate = pickObject(rawDetail.post, rawDetail.community_post, rawDetail.thread, rawDetail.item);
  if (Object.keys(candidate).length) return candidate;
  return rawDetail && !Array.isArray(rawDetail) ? rawDetail : {};
}

export function getDetailReplies(rawDetail) {
  return pickArray(rawDetail.replies, rawDetail.comments, rawDetail.community_replies, rawDetail.items);
}

export function isThreadDetailResponse(response) {
  return Boolean(
    response
      && typeof response === "object"
      && !Array.isArray(response)
      && (
        Array.isArray(response.replies)
        || Array.isArray(response.comments)
        || Array.isArray(response.community_replies)
        || getSafeText(response.title)
        || pickObject(response.post, response.community_post, response.thread, response.item).id
      )
  );
}
