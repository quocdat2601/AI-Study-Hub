import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import CommunityThreadItem from "../components/community/CommunityThreadItem.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getDocumentSignedUrl } from "../services/documentApi.js";
import { createCommunityReply, getCommunityPostDetail } from "../services/communityApi.js";

function getSafeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getSafeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatBytes(value) {
  const size = getSafeNumber(value);
  if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toFixed(1)} GB`;
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function pickObject(...values) {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
}

function pickArray(...values) {
  return values.find(Array.isArray) || [];
}

function normalizeRoleBadges(authorSource) {
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
    authorSource.displayName ||
      authorSource.display_name ||
      authorSource.full_name ||
      authorSource.name ||
      rawRecord.author_name
  ) || (email ? email.split("@")[0] : "Anonymous user");

  return {
    id: authorSource.id || rawRecord.user_id || rawRecord.author_id || rawRecord.created_by || null,
    displayName,
    avatarUrl: getSafeText(
      authorSource.avatarUrl ||
        authorSource.avatar_url ||
        authorSource.profile_photo_url ||
        authorSource.photo_url ||
        authorSource.image_url ||
        rawRecord.author_avatar_url
    ),
    email,
    roleBadges: normalizeRoleBadges(authorSource),
    joinedAt: authorSource.createdAt || authorSource.created_at || authorSource.joined_at || rawRecord.author_joined_at || null,
    postCount: authorSource.postCount || authorSource.post_count || authorSource.posts_count || authorSource.total_posts || rawRecord.author_post_count || 0,
    utilityPoints: authorSource.utilityPoints || authorSource.utility_points || authorSource.points || authorSource.reputation || rawRecord.author_utility_points || 0,
    href: getSafeText(authorSource.href || authorSource.profileHref || authorSource.profile_url),
  };
}

function normalizeMetrics(rawRecord = {}) {
  const metricsSource = pickObject(rawRecord.metrics, rawRecord.stat, rawRecord.stats);

  return {
    upvoteCount: getSafeNumber(
      rawRecord.voteCount ||
        rawRecord.upvoteCount ||
        rawRecord.upvote_count ||
        rawRecord.upvotes_count ||
        rawRecord.vote_count ||
        metricsSource.voteCount ||
        metricsSource.upvoteCount ||
        metricsSource.upvote_count ||
        metricsSource.votes ||
        0
    ),
  };
}

function normalizeLastActivity(rawRecord = {}) {
  const lastActivitySource = pickObject(rawRecord.lastActivity, rawRecord.last_activity, rawRecord.activity);
  const userSource = pickObject(lastActivitySource.user, lastActivitySource.users, lastActivitySource.author);

  return {
    at: lastActivitySource.at || lastActivitySource.createdAt || lastActivitySource.created_at || lastActivitySource.updated_at || rawRecord.updatedAt || rawRecord.updated_at || rawRecord.createdAt || rawRecord.created_at || null,
    userName: getSafeText(
      userSource.displayName ||
        userSource.display_name ||
        userSource.full_name ||
        userSource.name ||
        lastActivitySource.user_name
    ),
    avatarUrl: getSafeText(
      userSource.avatarUrl ||
        userSource.avatar_url ||
        userSource.profile_photo_url ||
        lastActivitySource.avatar_url
    ),
    href: getSafeText(lastActivitySource.href || lastActivitySource.url || userSource.profile_url),
  };
}

function normalizeAttachmentPayload(rawRecord = {}) {
  return pickObject(
    rawRecord.documentAttachment,
    rawRecord.chatAttachment,
    rawRecord.attachmentPayload,
    rawRecord.attachment_payload,
    rawRecord.attachment,
    rawRecord.document_share,
    rawRecord.document,
    rawRecord.shared_document,
    rawRecord.study_log,
    rawRecord.ai_study_log,
    rawRecord.metadata
  );
}

function normalizeThreadPost(rawRecord = {}, index) {
  return {
    id: rawRecord.id || rawRecord.reply_id || rawRecord.post_id || `community-item-${index}`,
    index,
    title: getSafeText(rawRecord.title || rawRecord.post_title || rawRecord.subject),
    content: getSafeText(rawRecord.content || rawRecord.body || rawRecord.reply_text || rawRecord.message, "No content yet."),
    createdAt: rawRecord.createdAt || rawRecord.created_at || rawRecord.inserted_at || rawRecord.published_at || null,
    author: normalizeAuthor(rawRecord),
    metrics: normalizeMetrics(rawRecord),
    lastActivity: normalizeLastActivity(rawRecord),
    postType: getSafeText(rawRecord.postType || rawRecord.post_type || rawRecord.type),
    attachmentPayload: normalizeAttachmentPayload(rawRecord),
  };
}

function getDetailPost(rawDetail) {
  const candidate = pickObject(rawDetail.post, rawDetail.community_post, rawDetail.thread, rawDetail.item);
  if (Object.keys(candidate).length) return candidate;
  return rawDetail && !Array.isArray(rawDetail) ? rawDetail : {};
}

function getDetailReplies(rawDetail) {
  return pickArray(rawDetail.replies, rawDetail.comments, rawDetail.community_replies, rawDetail.items);
}

function isThreadDetailResponse(response) {
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

function renderDocumentShareTeaser(payload, isAuthenticated, onOpenDocument) {
  const title = getSafeText(payload.title || payload.fileName || payload.document_title || payload.name, "Shared document");
  const sizeBytes = payload.fileSizeBytes || payload.size_bytes || payload.sizeBytes || payload.file_size_bytes || payload.byte_size;
  const resourceUrl = getSafeText(payload.viewUrl || payload.view_url || payload.downloadUrl || payload.download_url || payload.url);
  const canOpenProtectedDocument = isAuthenticated && (resourceUrl || payload.id);

  return (
    <div className="rounded-2xl border border-[#2c435d] bg-[#0f1b28] p-4 text-[#dbe7f5]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-xs font-black uppercase tracking-[0.8px] text-[#7ea2c7]">Document share</p>
          <h2 className="mt-2 text-lg font-black text-[#f5f9fd]">{title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#99afc6]">
            <span className="rounded-full border border-[#29415c] bg-[#122436] px-3 py-1 font-bold">Size: {formatBytes(sizeBytes)}</span>
            <span className="rounded-full border border-[#29415c] bg-[#122436] px-3 py-1 font-bold">Protected preview</span>
          </div>
        </div>

        {canOpenProtectedDocument ? (
          resourceUrl ? (
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#3970a8] bg-[#17345a] px-4 text-sm font-black text-[#dcecff] no-underline transition hover:bg-[#20436f]"
              href={resourceUrl}
            >
              Xem tài liệu
            </a>
          ) : (
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#3970a8] bg-[#17345a] px-4 text-sm font-black text-[#dcecff] transition hover:bg-[#20436f]"
              type="button"
              onClick={onOpenDocument}
            >
              Xem tài liệu
            </button>
          )
        ) : (
          <div className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dashed border-[#35506f] px-4 text-sm font-bold text-[#7f98b3]">
            {isAuthenticated ? "Tài liệu chưa sẵn sàng" : "Đăng nhập để xem hoặc tải tài liệu"}
          </div>
        )}
      </div>
    </div>
  );
}

function renderStudyLog(payload) {
  const session = pickObject(payload.session);
  const messages = pickArray(payload.messages, payload.chat_messages, payload.entries, payload.log);

  if (!messages.length) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-black uppercase tracking-[0.8px] text-[#7ea2c7]">AI study log</p>
          <h2 className="mt-2 text-lg font-black text-[#f5f9fd]">{getSafeText(session.title, "Đoạn hội thoại học tập đính kèm")}</h2>
        </div>
      </div>

      <div className="grid gap-3">
        {messages.map((message, index) => {
          const role = getSafeText(message.role, "assistant").toLowerCase();
          const content = getSafeText(message.content || message.text || message.message, "No message content.");
          const createdAt = message.createdAt || message.created_at || message.timestamp || null;
          const toneClass = role === "user"
            ? "border-[#27517d] bg-[#132941] text-[#dbeaff]"
            : "border-[#31445a] bg-[#101c29] text-[#dbe5f1]";

          return (
            <article className={`rounded-xl border p-3 ${toneClass}`} key={`${role}-${index}`}>
              <header className="flex items-center justify-between gap-3">
                <strong className="text-sm font-black uppercase tracking-[0.6px]">
                  {role === "user" ? "Bạn" : role === "assistant" ? "AI" : role}
                </strong>
                {createdAt ? <time className="text-xs font-bold text-[#8fa8c0]">{new Date(createdAt).toLocaleString("vi-VN")}</time> : null}
              </header>
              <p className="m-0 mt-2 whitespace-pre-wrap break-words text-sm leading-6">{content}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function buildAttachmentSlot(rootPost, isAuthenticated, onOpenDocument) {
  if (!rootPost) return null;

  if (rootPost.postType === "document_share") {
    return renderDocumentShareTeaser(rootPost.attachmentPayload || {}, isAuthenticated, onOpenDocument);
  }

  if (rootPost.postType === "ai_study_log") {
    return renderStudyLog(rootPost.attachmentPayload || {});
  }

  return null;
}

function DetailSkeleton() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_top,#1b2a3e,#0e141d_55%)] px-4 py-8 text-[#dbe5f1] sm:px-6">
      <div className="mx-auto grid max-w-[1120px] gap-5">
        <div className="h-6 w-52 rounded bg-[#1e2a38] animate-pulse" />
        <div className="overflow-hidden rounded-2xl border border-[#243142] bg-[#121a24]">
          <div className="grid md:grid-cols-[160px_minmax(0,1fr)]">
            <div className="border-b border-[#243142] bg-[#0f1721] p-4 md:border-b-0 md:border-r">
              <div className="h-20 w-20 rounded-full bg-[#1d2a39] animate-pulse" />
              <div className="mt-4 h-4 w-24 rounded bg-[#223244] animate-pulse" />
              <div className="mt-4 h-20 rounded bg-[#17212d] animate-pulse" />
            </div>
            <div className="p-5">
              <div className="h-4 w-36 rounded bg-[#1d2a39] animate-pulse" />
              <div className="mt-5 h-8 w-1/2 rounded bg-[#223244] animate-pulse" />
              <div className="mt-4 h-24 rounded bg-[#17212d] animate-pulse" />
            </div>
          </div>
        </div>
        <div className="h-12 rounded-2xl bg-[#121a24] animate-pulse" />
        <div className="h-48 rounded-2xl bg-[#121a24] animate-pulse" />
      </div>
    </main>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_top,#1b2a3e,#0e141d_55%)] px-4 py-8 text-[#dbe5f1] sm:px-6">
      <div className="mx-auto max-w-[1120px] rounded-2xl border border-[#263444] bg-[#121a24] p-8 text-center shadow-[0_18px_48px_rgba(4,10,18,0.22)]">
        <h1 className="m-0 text-[28px] font-black text-[#f5f9fd]">{title}</h1>
        <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-7 text-[#9eb0c4]">{description}</p>
        <div className="mt-6">{action}</div>
      </div>
    </main>
  );
}

export default function CommunityPostDetailPage() {
  const { id, postId } = useParams();
  const activePostId = id || postId;
  const location = useLocation();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const composerRef = useRef(null);
  const [threadDetail, setThreadDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      setIsLoading(true);
      setError("");

      try {
        const detail = await getCommunityPostDetail(activePostId);
        if (isMounted) {
          setThreadDetail(detail);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || err.response?.data?.message || "Không thể tải chủ đề cộng đồng.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [activePostId]);

  const normalizedDetail = useMemo(() => {
    const rootRecord = getDetailPost(threadDetail || {});
    const replies = getDetailReplies(threadDetail || {});
    const rootPost = Object.keys(rootRecord).length ? normalizeThreadPost(rootRecord, 1) : null;

    return {
      rootPost,
      replies: replies.map((reply, index) => normalizeThreadPost(reply, index + 2)),
    };
  }, [threadDetail]);

  async function handleOpenDocument() {
    const documentId = normalizedDetail.rootPost?.attachmentPayload?.id;
    if (!documentId || !isAuthenticated) {
      return;
    }

    try {
      setActionError("");
      const result = await getDocumentSignedUrl(documentId);
      if (result?.signedUrl) {
        window.open(result.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setActionError(err.response?.data?.error || "Không thể mở tài liệu đính kèm.");
    }
  }

  const attachmentSlot = buildAttachmentSlot(normalizedDetail.rootPost, isAuthenticated, handleOpenDocument);

  function focusComposer() {
    composerRef.current?.focus();
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleSubmitReply(event) {
    event.preventDefault();

    if (!isAuthenticated) {
      return;
    }

    const content = replyBody.trim();
    if (!content) {
      setReplyError("Vui lòng nhập câu trả lời trước khi gửi.");
      return;
    }

    setIsSubmitting(true);
    setReplyError("");

    try {
      const response = await createCommunityReply(activePostId, content);

      if (isThreadDetailResponse(response)) {
        setThreadDetail(response);
      } else {
        setThreadDetail((current) => {
          const detail = current || {};
          const existingReplies = getDetailReplies(detail);
          return {
            ...detail,
            replies: [...existingReplies, response],
          };
        });
      }

      setReplyBody("");
      setActionError("");
    } catch (err) {
      setReplyError(err.response?.data?.error || err.response?.data?.message || "Không thể gửi câu trả lời.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleShare(post) {
    const shareUrl = `${window.location.origin}/community/posts/${post?.id || activePostId}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        window.prompt("Sao chép liên kết chủ đề", shareUrl);
      }
    } catch (_) {
      window.prompt("Sao chép liên kết chủ đề", shareUrl);
    }
  }

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error) {
    return (
      <EmptyState
        title="Không tải được chủ đề"
        description={error}
        action={(
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#3f6ea0] bg-[#17345a] px-5 text-sm font-black text-[#e6f2ff]"
            type="button"
            onClick={() => {
              setThreadDetail(null);
              setIsLoading(true);
              setError("");
              getCommunityPostDetail(activePostId)
                .then((detail) => {
                  setThreadDetail(detail);
                  setIsLoading(false);
                })
                .catch((err) => {
                  setError(err.response?.data?.error || err.response?.data?.message || "Không thể tải chủ đề cộng đồng.");
                  setIsLoading(false);
                });
            }}
          >
            Thử lại
          </button>
        )}
      />
    );
  }

  if (!normalizedDetail.rootPost) {
    return (
      <EmptyState
        title="Không tìm thấy chủ đề"
        description="Bài viết này không tồn tại, đã bị xóa hoặc chưa sẵn sàng để hiển thị."
        action={(
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#3f6ea0] bg-[#17345a] px-5 text-sm font-black text-[#e6f2ff] no-underline"
            to="/community"
          >
            Quay lại cộng đồng
          </Link>
        )}
      />
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_top,#1b2a3e,#0e141d_55%)] px-4 py-8 text-[#dbe5f1] sm:px-6">
      <div className="mx-auto grid max-w-[1120px] gap-5">
        <Link className="inline-flex w-fit items-center gap-2 text-sm font-black text-[#9cc7ff] no-underline transition hover:text-[#c2ddff]" to="/community">
          <span aria-hidden="true">←</span>
          <span>Quay lại trang cộng đồng</span>
        </Link>

        {actionError ? (
          <div className="rounded-xl border border-[#6f2830] bg-[#34161b] px-4 py-3 text-sm font-bold text-[#ffbdc3]">
            {actionError}
          </div>
        ) : null}

        <CommunityThreadItem
          post={normalizedDetail.rootPost}
          isRootPost
          attachmentSlot={attachmentSlot}
          onReply={focusComposer}
          onShare={handleShare}
          LinkComponent={Link}
        />

        <section className="flex items-center gap-4 rounded-2xl border border-[#243142] bg-[#121a24] px-5 py-4">
          <span className="h-px flex-1 bg-[#2a3a4c]" />
          <h2 className="m-0 text-sm font-black uppercase tracking-[0.9px] text-[#aac2d9]">
            Ý kiến sinh viên ({normalizedDetail.replies.length} trả lời)
          </h2>
          <span className="h-px flex-1 bg-[#2a3a4c]" />
        </section>

        <section className="grid gap-4">
          {normalizedDetail.replies.map((reply) => (
            <CommunityThreadItem
              key={reply.id}
              post={reply}
              isRootPost={false}
              onReply={focusComposer}
              onShare={handleShare}
              LinkComponent={Link}
            />
          ))}
        </section>

        <section className="rounded-2xl border border-[#243142] bg-[#121a24] p-5 shadow-[0_18px_48px_rgba(4,10,18,0.22)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="m-0 text-xs font-black uppercase tracking-[0.8px] text-[#7f9ab5]">Tham gia thảo luận</p>
              <h2 className="mt-2 text-2xl font-black text-[#f5f9fd]">Câu trả lời của bạn</h2>
            </div>
            {!isAuthLoading && !isAuthenticated ? (
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#35506f] px-4 text-sm font-black text-[#a8c6e7] no-underline transition hover:border-[#4e77a1] hover:text-[#d8ebff]"
                to="/login"
                state={{ from: location }}
              >
                Đăng nhập để trả lời
              </Link>
            ) : null}
          </div>

          <form className="grid gap-3" onSubmit={handleSubmitReply}>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#9eb0c4]">Câu trả lời của bạn</span>
              <textarea
                ref={composerRef}
                className="min-h-[180px] w-full resize-y rounded-2xl border border-[#29405a] bg-[#0f1823] px-4 py-3 text-[15px] leading-7 text-[#e2e9f2] outline-none transition placeholder:text-[#5f7286] focus:border-[#4d7bb0] focus:shadow-[0_0_0_4px_rgba(77,123,176,0.15)] disabled:cursor-not-allowed disabled:border-[#223142] disabled:bg-[#111924] disabled:text-[#7b8fa4]"
                placeholder={isAuthenticated ? "Chia sẻ góc nhìn, tài liệu hoặc kinh nghiệm học tập của bạn..." : "Đăng nhập để gửi câu trả lời cho chủ đề này."}
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                disabled={!isAuthenticated || isSubmitting}
              />
            </label>

            {replyError ? (
              <div className="rounded-xl border border-[#6f2830] bg-[#34161b] px-4 py-3 text-sm font-bold text-[#ffbdc3]">
                {replyError}
              </div>
            ) : null}

            {!isAuthLoading && !isAuthenticated ? (
              <div className="rounded-xl border border-dashed border-[#36516f] bg-[#0f1823] px-4 py-3 text-sm text-[#8ba4bc]">
                Khách chỉ có thể đọc chủ đề và xem teaser đính kèm. Hãy đăng nhập để gửi phản hồi mới.
              </div>
            ) : null}

            <div className="flex items-center justify-end">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#3970a8] bg-[#1a4678] px-5 text-sm font-black text-[#eff6ff] transition hover:bg-[#20558f] disabled:cursor-not-allowed disabled:border-[#29405a] disabled:bg-[#162434] disabled:text-[#7f95ac]"
                type="submit"
                disabled={!isAuthenticated || isSubmitting || !replyBody.trim()}
              >
                {isSubmitting ? "Đang gửi..." : "Gửi câu trả lời"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
