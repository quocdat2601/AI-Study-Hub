import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import CommunityAttachmentPreview from "../components/community/CommunityAttachmentPreview.jsx";
import CommunityBanner from "../components/community/CommunityBanner.jsx";
import { buildCommunityPanelSearch } from "../components/community/communityPanelUtils.js";
import CommunityThreadItem from "../components/community/CommunityThreadItem.jsx";
import DashboardSidebar from "../components/dashboard/DashboardSidebar.jsx";
import {
  getDetailPost,
  getDetailReplies,
  isThreadDetailResponse,
  normalizeThreadPost,
} from "../components/community/communityThreadViewModel.js";
import { formatForumDate, getSafeText, getUserDisplayName } from "../components/community/communityUtils.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getDocumentSignedUrl } from "../services/documentApi.js";
import { acceptCommunityReply, createCommunityReply, getCommunityPostDetail } from "../services/communityApi.js";

function DetailPageShell({
  isAuthenticated,
  isSidebarCollapsed,
  onSidebarSectionChange,
  onToggleSidebar,
  userName,
  children,
}) {
  const shellClass = isAuthenticated
    ? (isSidebarCollapsed
      ? "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [grid-template-columns:64px_minmax(0,1fr)] [scrollbar-gutter:stable]"
      : "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [grid-template-columns:224px_minmax(0,1fr)] [scrollbar-gutter:stable]")
    : "min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [scrollbar-gutter:stable]";
  const contentClass = isAuthenticated
    ? (isSidebarCollapsed ? "px-4 py-4 lg:px-6" : "p-5 lg:p-6")
    : "px-4 py-5 md:px-8";

  return (
    <main className={shellClass}>
      {isAuthenticated ? (
        <DashboardSidebar
          activeSection="community"
          isCollapsed={isSidebarCollapsed}
          onSectionChange={onSidebarSectionChange}
          onToggleCollapse={onToggleSidebar}
          userName={userName}
          newDocumentTo="/library"
          newDocumentLabel="Upload Document"
        />
      ) : null}

      <section className={contentClass}>
        <div className="mx-auto grid w-full max-w-[1120px] gap-5">
          {children}
        </div>
      </section>
    </main>
  );
}

function DetailSkeleton(props) {
  return (
    <DetailPageShell {...props}>
        <div className="h-6 w-52 rounded bg-[#e8edf5] animate-pulse" />
        <div className="overflow-hidden rounded-[24px] border border-[#dbe3ed] bg-white">
          <div className="grid md:grid-cols-[160px_minmax(0,1fr)]">
            <div className="border-b border-[#dbe3ed] bg-[#f7f9fb] p-4 md:border-b-0 md:border-r">
              <div className="h-20 w-20 rounded-full bg-[#e8edf5] animate-pulse" />
              <div className="mt-4 h-4 w-24 rounded bg-[#eef2f7] animate-pulse" />
              <div className="mt-4 h-20 rounded bg-[#eef2f7] animate-pulse" />
            </div>
            <div className="p-5">
              <div className="h-4 w-36 rounded bg-[#e8edf5] animate-pulse" />
              <div className="mt-5 h-8 w-1/2 rounded bg-[#eef2f7] animate-pulse" />
              <div className="mt-4 h-24 rounded bg-[#eef2f7] animate-pulse" />
            </div>
          </div>
        </div>
        <div className="h-12 rounded-[24px] border border-[#dbe3ed] bg-white animate-pulse" />
        <div className="h-48 rounded-[24px] border border-[#dbe3ed] bg-white animate-pulse" />
    </DetailPageShell>
  );
}

function EmptyState({ title, description, action, ...shellProps }) {
  return (
    <DetailPageShell {...shellProps}>
      <div className="mx-auto max-w-[1120px] rounded-[24px] border border-[#dbe3ed] bg-white p-8 text-center shadow-[0_18px_40px_rgba(20,31,48,0.06)]">
        <h1 className="m-0 text-[28px] font-black text-[#172033]">{title}</h1>
        <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-7 text-[#66758a]">{description}</p>
        <div className="mt-6">{action}</div>
      </div>
    </DetailPageShell>
  );
}

export default function CommunityPostDetailPage() {
  const { id, postId } = useParams();
  const activePostId = id || postId;
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const composerRef = useRef(null);
  const [threadDetail, setThreadDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptingReplyId, setAcceptingReplyId] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const displayName = getUserDisplayName(user);

  function handleSidebarSectionChange(sectionId) {
    if (!sectionId || sectionId === "community") return;
    navigate("/dashboard", {
      state: { activeSection: sectionId },
    });
  }

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
          setError(err.response?.data?.error || err.response?.data?.message || "Could not load this community thread.");
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
      setActionError(err.response?.data?.error || "Could not open the attached document.");
    }
  }

  const attachmentSlot = normalizedDetail.rootPost && ["document_share", "ai_study_log"].includes(normalizedDetail.rootPost.postType)
    ? (
        <CommunityAttachmentPreview
          post={normalizedDetail.rootPost}
          isAuthenticated={isAuthenticated}
          onOpenDocument={handleOpenDocument}
          variant="light"
        />
      )
    : null;
  const detailNavItems = [
    { id: "find", label: "Find", to: `/community${buildCommunityPanelSearch({ panel: "find" })}` },
    { id: "new", label: "New Post", to: `/community${buildCommunityPanelSearch({ panel: "new", composeType: "discussion" })}` },
    { id: "people", label: "Top Contributors", to: `/community${buildCommunityPanelSearch({ panel: "people" })}` },
  ];
  const detailBannerBadges = normalizedDetail.rootPost?.category?.label ? [normalizedDetail.rootPost.category.label] : [];
  const detailBannerChips = (normalizedDetail.rootPost?.subjects || [])
    .map((subject) => getSafeText(subject.code) || getSafeText(subject.name))
    .filter(Boolean);
  const replyCount = normalizedDetail.rootPost?.metrics?.replyCount || 0;
  const detailBannerMeta = normalizedDetail.rootPost ? [
    `By ${getSafeText(normalizedDetail.rootPost.author?.displayName) || getSafeText(normalizedDetail.rootPost.author?.email, "Student")}`,
    formatForumDate(normalizedDetail.rootPost.createdAt, { includeTime: true }),
    `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`,
  ] : [];
  const isPostOwner = Boolean(
    user?.id
      && normalizedDetail.rootPost?.author?.id
      && String(user.id) === String(normalizedDetail.rootPost.author.id)
  );
  const canAcceptReplies = Boolean(
    isAuthenticated
      && isPostOwner
      && normalizedDetail.rootPost?.postType === "question"
  );

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
      setReplyError("Enter a reply before submitting.");
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
      setReplyError(err.response?.data?.error || err.response?.data?.message || "Could not submit your reply.");
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
        window.prompt("Copy thread link", shareUrl);
      }
    } catch (_) {
      window.prompt("Copy thread link", shareUrl);
    }
  }

  async function handleAcceptReply(reply) {
    if (!canAcceptReplies || !reply?.id || !normalizedDetail.rootPost?.id) {
      return;
    }

    setAcceptingReplyId(reply.id);
    setActionError("");

    try {
      const response = await acceptCommunityReply(normalizedDetail.rootPost.id, reply.id);
      setThreadDetail(response);
      setReplyError("");
    } catch (err) {
      setActionError(err.response?.data?.error || err.response?.data?.message || "Could not mark this reply as the accepted answer.");
    } finally {
      setAcceptingReplyId(null);
    }
  }

  if (isLoading) {
    return (
      <DetailSkeleton
        isAuthenticated={isAuthenticated}
        isSidebarCollapsed={isSidebarCollapsed}
        onSidebarSectionChange={handleSidebarSectionChange}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
        userName={displayName}
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        isAuthenticated={isAuthenticated}
        isSidebarCollapsed={isSidebarCollapsed}
        onSidebarSectionChange={handleSidebarSectionChange}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
        userName={displayName}
        title="Could not load thread"
        description={error}
        action={(
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#4648d4] bg-[#4648d4] px-5 text-sm font-black text-white"
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
                  setError(err.response?.data?.error || err.response?.data?.message || "Could not load this community thread.");
                  setIsLoading(false);
                });
            }}
          >
            Try again
          </button>
        )}
      />
    );
  }

  if (!normalizedDetail.rootPost) {
    return (
      <EmptyState
        isAuthenticated={isAuthenticated}
        isSidebarCollapsed={isSidebarCollapsed}
        onSidebarSectionChange={handleSidebarSectionChange}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
        userName={displayName}
        title="Thread not found"
        description="This post does not exist, has been removed, or is not available yet."
        action={(
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#4648d4] bg-[#4648d4] px-5 text-sm font-black text-white no-underline"
            to="/community"
          >
            Back to community
          </Link>
        )}
      />
    );
  }

  return (
    <DetailPageShell
      isAuthenticated={isAuthenticated}
      isSidebarCollapsed={isSidebarCollapsed}
      onSidebarSectionChange={handleSidebarSectionChange}
      onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
      userName={displayName}
    >
        <CommunityBanner
          title={normalizedDetail.rootPost.title || "Untitled thread"}
          navItems={detailNavItems}
          badges={detailBannerBadges}
          chips={detailBannerChips}
          metaItems={detailBannerMeta}
          LinkComponent={Link}
        />

        {actionError ? (
          <div className="rounded-xl border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-sm font-bold text-[#991b1b]">
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
          variant="light"
          showTitle={false}
          showCreatedMeta
        />

        <section className="flex items-center gap-4 rounded-[24px] border border-[#dbe3ed] bg-white px-5 py-4 shadow-[0_18px_40px_rgba(20,31,48,0.05)]">
          <span className="h-px flex-1 bg-[#dbe3ed]" />
          <h2 className="m-0 text-sm font-black uppercase tracking-[0.9px] text-[#66758a]">
            Users replies ({normalizedDetail.replies.length})
          </h2>
          <span className="h-px flex-1 bg-[#dbe3ed]" />
        </section>

        <section className="grid gap-4">
          {normalizedDetail.replies.map((reply) => (
            <CommunityThreadItem
              key={reply.id}
              post={reply}
              isRootPost={false}
              footerActionSlot={reply.isAccepted ? (
                <span className="inline-flex min-h-10 items-center rounded-full border border-[#bfe5d3] bg-[#ecfff5] px-4 text-sm font-black text-[#166534]">
                  Accepted answer
                </span>
              ) : canAcceptReplies ? (
                <button
                  className="inline-flex min-h-10 items-center rounded-full border border-[#bfe5d3] bg-white px-4 text-sm font-black text-[#166534] transition hover:border-[#16a34a] hover:bg-[#f0fdf4] disabled:cursor-not-allowed disabled:border-[#dbe3ed] disabled:text-[#7f95ac]"
                  disabled={Boolean(acceptingReplyId)}
                  onClick={() => handleAcceptReply(reply)}
                  type="button"
                >
                  {acceptingReplyId === reply.id ? "Saving..." : "Mark as answer"}
                </button>
              ) : null}
              onReply={focusComposer}
              onShare={handleShare}
              LinkComponent={Link}
              variant="light"
            />
          ))}
        </section>

        <section className="rounded-[24px] border border-[#dbe3ed] bg-white p-5 shadow-[0_18px_40px_rgba(20,31,48,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="m-0 text-xs font-black uppercase tracking-[0.8px] text-[#66758a]">Join the discussion</p>
              <h2 className="mt-2 text-2xl font-black text-[#172033]">Your reply</h2>
            </div>
            {!isAuthLoading && !isAuthenticated ? (
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#dbe3ed] px-4 text-sm font-black text-[#4648d4] no-underline transition hover:border-[#4648d4] hover:bg-[#eef2ff]"
                to="/login"
                state={{ from: location }}
              >
                Log in to reply
              </Link>
            ) : null}
          </div>

          <form className="grid gap-3" onSubmit={handleSubmitReply}>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#66758a]">Your reply</span>
              <textarea
                ref={composerRef}
                className="min-h-[180px] w-full resize-y rounded-[22px] border border-[#dbe3ed] bg-[#f8fafc] px-4 py-3 text-[15px] leading-7 text-[#172033] outline-none transition placeholder:text-[#7a8798] focus:border-[#4648d4] focus:bg-white focus:shadow-[0_0_0_4px_rgba(70,72,212,0.12)] disabled:cursor-not-allowed disabled:border-[#dbe3ed] disabled:bg-[#f2f5f8] disabled:text-[#7b8fa4]"
                placeholder={isAuthenticated ? "Share your explanation, resource, or study experience..." : "Log in to reply to this thread."}
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                disabled={!isAuthenticated || isSubmitting}
              />
            </label>

            {replyError ? (
              <div className="rounded-xl border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-sm font-bold text-[#991b1b]">
                {replyError}
              </div>
            ) : null}

            {!isAuthLoading && !isAuthenticated ? (
              <div className="rounded-xl border border-dashed border-[#c7d2e2] bg-[#f8fafc] px-4 py-3 text-sm text-[#66758a]">
                Guests can read the thread and view previews. Log in to join the conversation.
              </div>
            ) : null}

            <div className="flex items-center justify-end">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#4648d4] bg-[#4648d4] px-5 text-sm font-black text-white transition hover:bg-[#3537b8] disabled:cursor-not-allowed disabled:border-[#c7d2e2] disabled:bg-[#e5e7eb] disabled:text-[#7f95ac]"
                type="submit"
                disabled={!isAuthenticated || isSubmitting || !replyBody.trim()}
              >
                {isSubmitting ? "Posting..." : "Post Reply"}
              </button>
            </div>
          </form>
        </section>
    </DetailPageShell>
  );
}
