import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import CommunityAttachmentPreview from "../components/community/CommunityAttachmentPreview.jsx";
import CommunityBanner from "../components/community/CommunityBanner.jsx";
import CommunityPageShell from "../components/community/CommunityPageShell.jsx";
import CommunityReportModal from "../components/community/CommunityReportModal.jsx";
import CommunityConfirmModal from "../components/community/CommunityConfirmModal.jsx";
import CommunityThreadItem from "../components/community/CommunityThreadItem.jsx";
import {
  getDetailPost,
  getDetailReplies,
  isThreadDetailResponse,
  normalizeThreadPost,
} from "../components/community/communityThreadViewModel.js";
import { formatForumDate, getSafeText } from "../components/community/communityUtils.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import useCommunityRealtime from "../hooks/useCommunityRealtime.js";
import { getDocumentSignedUrl } from "../services/documentApi.js";
import {
  acceptCommunityReply,
  createCommunityReply,
  deleteCommunityPost,
  deleteCommunityReply,
  editCommunityPost,
  editCommunityReply,
  getCommunityPostDetail,
  reportCommunityPost,
  toggleCommunityPostVote,
  toggleCommunityReplyVote,
} from "../services/communityApi.js";

function EditReplyForm({ initialBody, onSave, onCancel }) {
  const [body, setBody] = React.useState(initialBody || "");
  const [isSaving, setIsSaving] = React.useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setIsSaving(true);
    try {
      await onSave(body);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#4648d4] bg-white p-5 shadow-[0_18px_40px_rgba(20,31,48,0.06)]">
      <p className="m-0 mb-3 text-xs font-black uppercase tracking-[0.8px] text-[#4648d4]">Editing comment</p>
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <textarea
          autoFocus
          className="min-h-[120px] w-full resize-y rounded-[18px] border border-[#dbe3ed] bg-[#f8fafc] px-4 py-3 text-[15px] leading-7 text-[#172033] outline-none transition focus:border-[#4648d4] focus:bg-white focus:shadow-[0_0_0_4px_rgba(70,72,212,0.12)]"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={isSaving}
        />
        <div className="flex items-center justify-end gap-3">
          <button
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[#dbe3ed] bg-white px-4 text-sm font-black text-[#172033] transition hover:border-[#172033]"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[#4648d4] bg-[#4648d4] px-4 text-sm font-black text-white transition hover:bg-[#3537b8] disabled:cursor-not-allowed disabled:border-[#c7d2e2] disabled:bg-[#e5e7eb] disabled:text-[#7f95ac]"
            type="submit"
            disabled={isSaving || !body.trim()}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditPostForm({ initialTitle, initialBody, onSave, onCancel }) {
  const [title, setTitle] = React.useState(initialTitle || "");
  const [body, setBody] = React.useState(initialBody || "");
  const [isSaving, setIsSaving] = React.useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setIsSaving(true);
    try {
      await onSave(title, body);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#4648d4] bg-white p-5 shadow-[0_18px_40px_rgba(20,31,48,0.06)] mb-6">
      <p className="m-0 mb-3 text-xs font-black uppercase tracking-[0.8px] text-[#4648d4]">Editing post</p>
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <input
          autoFocus
          type="text"
          className="w-full rounded-xl border border-[#dbe3ed] bg-[#f8fafc] px-4 py-2 text-[15px] font-bold text-[#172033] outline-none transition focus:border-[#4648d4] focus:bg-white"
          placeholder="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={isSaving}
        />
        <textarea
          className="min-h-[180px] w-full resize-y rounded-[18px] border border-[#dbe3ed] bg-[#f8fafc] px-4 py-3 text-[15px] leading-7 text-[#172033] outline-none transition focus:border-[#4648d4] focus:bg-white"
          placeholder="Body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={isSaving}
        />
        <div className="flex items-center justify-end gap-3">
          <button
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[#dbe3ed] bg-white px-4 text-sm font-black text-[#172033] transition hover:border-[#172033]"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[#4648d4] bg-[#4648d4] px-4 text-sm font-black text-white transition hover:bg-[#3537b8] disabled:cursor-not-allowed"
            type="submit"
            disabled={isSaving || !title.trim() || !body.trim()}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DetailSkeleton({ isAuthenticated }) {
  return (
    <CommunityPageShell
      isAuthenticated={isAuthenticated}
    >
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 rounded bg-[#e8edf5] animate-pulse" />
        <span className="text-xs text-[#a0aec0] font-bold">/</span>
        <div className="h-5 w-32 rounded bg-[#e8edf5] animate-pulse" />
      </div>
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
    </CommunityPageShell>
  );
}

function EmptyState({ title, description, action, isAuthenticated }) {
  return (
    <CommunityPageShell
      isAuthenticated={isAuthenticated}
    >
      <div className="mx-auto max-w-[1120px] rounded-[24px] border border-[#dbe3ed] bg-white p-8 text-center shadow-[0_18px_40px_rgba(20,31,48,0.06)]">
        <h1 className="m-0 text-[28px] font-black text-[#172033]">{title}</h1>
        <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-7 text-[#66758a]">{description}</p>
        <div className="mt-6">{action}</div>
      </div>
    </CommunityPageShell>
  );
}

export default function CommunityPostDetailPage() {
  const { id, postId } = useParams();
  const activePostId = id || postId;
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const composerRef = useRef(null);
  const { addToast } = useToast();
  const highlightTimeoutRef = useRef(null);
  const handledReplyHashRef = useRef("");
  const isMountedRef = useRef(true);
  const latestLoadIdRef = useRef(0);
  const postVotePendingRef = useRef(false);
  const pendingReplyVoteIdsRef = useRef(new Set());
  const recentVoteMutationRef = useRef(new Map());
  const [threadDetail, setThreadDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptingReplyId, setAcceptingReplyId] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [pendingScrollReplyId, setPendingScrollReplyId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportError, setReportError] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [reportedKeys, setReportedKeys] = useState({});
  const [highlightedReplyId, setHighlightedReplyId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const [editingReply, setEditingReply] = useState(null);
  const [isEditingPost, setIsEditingPost] = useState(false);

  const loadThreadDetail = useCallback(async ({ showLoading = true } = {}) => {
    const loadId = latestLoadIdRef.current + 1;
    latestLoadIdRef.current = loadId;

    if (showLoading) {
      setIsLoading(true);
    }

    setError("");

    try {
      const detail = await getCommunityPostDetail(activePostId);
      if (!isMountedRef.current || latestLoadIdRef.current !== loadId) return;
      setThreadDetail(detail);
    } catch (err) {
      if (!isMountedRef.current || latestLoadIdRef.current !== loadId) return;
      setError(err.response?.data?.error || err.response?.data?.message || "Could not load this community thread.");
    } finally {
      if (isMountedRef.current && latestLoadIdRef.current === loadId) {
        setIsLoading(false);
      }
    }
  }, [activePostId]);

  useEffect(() => {
    loadThreadDetail();
  }, [loadThreadDetail]);

  useEffect(() => () => {
    isMountedRef.current = false;
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    handledReplyHashRef.current = "";
  }, [activePostId]);

  useCommunityRealtime({
    channelKey: `community-post-${activePostId}-live`,
    filter: `post_id=eq.${activePostId}`,
    enabled: Boolean(activePostId),
    getDebounceMs: (payload) => {
      const eventType = payload?.new?.event_type;
      if (eventType === "post_vote_changed" || eventType === "reply_vote_changed") {
        return 60;
      }
      return 220;
    },
    onSignal: (payload) => {
      const eventType = payload?.new?.event_type;

      if (eventType === "post_vote_changed") {
        const targetKey = `post:${payload?.new?.post_id || activePostId}`;
        if (hasRecentVoteMutation(targetKey)) {
          return;
        }
      }

      if (eventType === "reply_vote_changed") {
        const targetKey = `reply:${payload?.new?.reply_id || ""}`;
        if (hasRecentVoteMutation(targetKey)) {
          return;
        }
      }

      loadThreadDetail({ showLoading: false });
    },
  });

  const normalizedDetail = useMemo(() => {
    const rootRecord = getDetailPost(threadDetail || {});
    const replies = getDetailReplies(threadDetail || {});
    const rootPost = Object.keys(rootRecord).length ? normalizeThreadPost(rootRecord, 1) : null;
    const normalizedReplies = replies.map((reply, index) => normalizeThreadPost(reply, index + 2));
    const replyIndexById = new Map(normalizedReplies.map((reply) => [String(reply.id), reply.index]));

    return {
      rootPost,
      replies: normalizedReplies.map((reply) => ({
        ...reply,
        parentReplyIndex: reply.parentReplyId ? (replyIndexById.get(String(reply.parentReplyId)) || null) : null,
      })),
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
    { id: "find", label: "Find", to: "/community" },
    { id: "new", label: "New Post", to: "/community/new?compose=discussion" },
    { id: "people", label: "Top Contributors", to: "/community?panel=people" },
  ];
  const detailBannerBadges = normalizedDetail.rootPost?.category?.label ? [normalizedDetail.rootPost.category] : [];
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

  function showNotice(message, tone = "success") {
    addToast({
      type: tone === "info" ? "info" : tone === "error" ? "error" : "success",
      title: tone === "error" ? "Error" : tone === "info" ? "Info" : "Success",
      message: message,
    });
  }

  function getReplyAnchorId(replyId) {
    return `community-reply-${replyId}`;
  }

  const scrollToReply = useCallback((replyId) => {
    if (!replyId) return false;

    const element = document.getElementById(getReplyAnchorId(replyId));
    if (!element) return false;

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${getReplyAnchorId(replyId)}`);
    return true;
  }, []);

  const highlightReply = useCallback((replyId) => {
    if (!replyId) return;

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    setHighlightedReplyId(String(replyId));
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedReplyId(null);
      highlightTimeoutRef.current = null;
    }, 2600);
  }, []);

  const rememberRecentVoteMutation = useCallback((key, ttlMs = 3200) => {
    if (!key) return;
    recentVoteMutationRef.current.set(String(key), Date.now() + Math.max(250, Number(ttlMs) || 0));
  }, []);

  const hasRecentVoteMutation = useCallback((key) => {
    if (!key) return false;

    const mutationKey = String(key);
    const expiresAt = recentVoteMutationRef.current.get(mutationKey);
    if (!expiresAt) {
      return false;
    }

    if (expiresAt <= Date.now()) {
      recentVoteMutationRef.current.delete(mutationKey);
      return false;
    }

    return true;
  }, []);

  const focusReply = useCallback((replyId) => {
    if (!replyId) return false;

    const didScroll = scrollToReply(replyId);
    if (!didScroll) return false;

    handledReplyHashRef.current = `#${getReplyAnchorId(replyId)}`;
    highlightReply(replyId);
    return true;
  }, [highlightReply, scrollToReply]);

  useEffect(() => {
    if (!pendingScrollReplyId) return;

    const animationFrame = window.requestAnimationFrame(() => {
      if (focusReply(pendingScrollReplyId)) {
        setPendingScrollReplyId(null);
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [focusReply, pendingScrollReplyId, threadDetail]);

  useEffect(() => {
    if (!threadDetail || !location.hash.startsWith("#community-reply-")) return;
    if (handledReplyHashRef.current === location.hash) return;

    const targetId = Number(location.hash.replace("#community-reply-", ""));
    if (!Number.isInteger(targetId) || targetId <= 0) return;

    const animationFrame = window.requestAnimationFrame(() => {
      focusReply(targetId);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [focusReply, location.hash, threadDetail]);

  function openLoginForAction() {
    navigate("/login", { state: { from: location } });
  }

  function buildReportKey(type, targetId) {
    return `${type}:${targetId}`;
  }

  function openReportModal(target) {
    if (!isAuthenticated) {
      openLoginForAction();
      return;
    }

    setReportTarget(target);
    setReportReason("");
    setReportError("");
  }

  function focusComposer() {
    composerRef.current?.focus();
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleReplyToPost() {
    if (!isAuthenticated) {
      openLoginForAction();
      return;
    }

    setReplyTarget(null);
    focusComposer();
  }

  function handleReplyToReply(reply) {
    if (!isAuthenticated) {
      openLoginForAction();
      return;
    }

    setReplyTarget({
      id: reply.id,
      index: reply.index || null,
      author: reply.author,
      excerpt: reply.excerpt || reply.content || "",
    });
    focusComposer();
  }

  function handleParentReplyClick(reply) {
    const targetReplyId = reply?.parentReply?.id || reply?.parentReplyId;
    if (!targetReplyId) return;
    focusReply(targetReplyId);
  }

  function triggerDeletePost(post) {
    if (!isAuthenticated) {
      openLoginForAction();
      return;
    }
    if (!post?.id) return;

    setConfirmModal({
      isOpen: true,
      title: "Delete post",
      message: "Are you sure you want to delete this post? This action cannot be undone.",
      onConfirm: () => performDeletePost(post.id),
    });
  }

  async function performDeletePost(postId) {
    setConfirmModal((current) => ({ ...current, isOpen: false }));
    try {
      setActionError("");
      await deleteCommunityPost(postId);
      showNotice("Post deleted");
      navigate("/community");
    } catch (err) {
      setActionError(err.response?.data?.error || err.response?.data?.message || "Could not delete this post.");
    }
  }

  function triggerDeleteReply(reply) {
    if (!isAuthenticated) {
      openLoginForAction();
      return;
    }
    if (!reply?.id) return;

    setConfirmModal({
      isOpen: true,
      title: "Delete comment",
      message: "Are you sure you want to delete this comment? This action cannot be undone.",
      onConfirm: () => performDeleteReply(reply.id),
    });
  }

  async function performDeleteReply(replyId) {
    setConfirmModal((current) => ({ ...current, isOpen: false }));
    try {
      setActionError("");
      const response = await deleteCommunityReply(replyId);
      setThreadDetail(response);
      if (replyTarget?.id && String(replyTarget.id) === String(replyId)) {
        setReplyTarget(null);
      }
      if (editingReply?.id && String(editingReply.id) === String(replyId)) {
        setEditingReply(null);
      }
      showNotice("Comment deleted");
    } catch (err) {
      setActionError(err.response?.data?.error || err.response?.data?.message || "Could not delete this comment.");
    }
  }

  async function handleSaveEditReply(replyId, newBody) {
    if (!newBody.trim()) return;
    try {
      setActionError("");
      const response = await editCommunityReply(replyId, newBody.trim());
      setThreadDetail(response);
      setEditingReply(null);
      showNotice("Comment updated");
    } catch (err) {
      setActionError(err.response?.data?.error || err.response?.data?.message || "Could not update this comment.");
    }
  }

  async function handleSaveEditPost(newTitle, newBody) {
    if (!newTitle.trim() || !newBody.trim()) return;
    try {
      setActionError("");
      const response = await editCommunityPost(normalizedDetail.rootPost.id, {
        title: newTitle.trim(),
        body: newBody.trim(),
      });
      setThreadDetail(response);
      setIsEditingPost(false);
      showNotice("Post updated");
    } catch (err) {
      setActionError(err.response?.data?.error || err.response?.data?.message || "Could not update this post.");
    }
  }

  async function handleSubmitReply(event) {
    event.preventDefault();

    if (!isAuthenticated) {
      openLoginForAction();
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
      const response = await createCommunityReply(activePostId, {
        body: content,
        parentReplyId: replyTarget?.id || undefined,
      });
      const createdReplyId = isThreadDetailResponse(response)
        ? getDetailReplies(response).at(-1)?.id || null
        : response?.id || null;

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
      setReplyTarget(null);
      setActionError("");
      setPendingScrollReplyId(createdReplyId);
      showNotice("Reply posted");
    } catch (err) {
      setReplyError(err.response?.data?.error || err.response?.data?.message || "Could not submit your reply.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleShare(item) {
    const isReply = Boolean(item && item.postId);
    const targetPostId = isReply ? item.postId : (item?.id || activePostId);
    const hash = isReply ? `#community-reply-${item.id}` : "";
    const shareUrl = `${window.location.origin}/community/posts/${targetPostId}${hash}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showNotice("Link copied");
      } else {
        window.prompt("Copy thread link", shareUrl);
      }
    } catch (_) {
      window.prompt("Copy thread link", shareUrl);
    }
  }

  async function handlePostVote() {
    if (!isAuthenticated) {
      openLoginForAction();
      return;
    }
    if (postVotePendingRef.current) return;

    const previousVoted = Boolean(normalizedDetail.rootPost?.isUpvoted);
    const previousVoteCount = Number(normalizedDetail.rootPost?.metrics?.upvoteCount || 0);
    const nextVoted = !previousVoted;
    const nextVoteCount = Math.max(0, previousVoteCount + (nextVoted ? 1 : -1));

    postVotePendingRef.current = true;
    setActionError("");
    setThreadDetail((current) => current ? {
      ...current,
      voteCount: nextVoteCount,
      isUpvoted: nextVoted,
      viewerUpvoted: nextVoted,
    } : current);
    rememberRecentVoteMutation(`post:${activePostId}`);

    try {
      const result = await toggleCommunityPostVote(activePostId);
      setThreadDetail((current) => current ? {
        ...current,
        voteCount: result.voteCount,
        isUpvoted: result.voted,
        viewerUpvoted: result.voted,
      } : current);
    } catch (err) {
      setThreadDetail((current) => current ? {
        ...current,
        voteCount: previousVoteCount,
        isUpvoted: previousVoted,
        viewerUpvoted: previousVoted,
      } : current);
      setActionError(err.response?.data?.error || err.response?.data?.message || "Could not update the post vote.");
    } finally {
      postVotePendingRef.current = false;
    }
  }

  async function handleReplyVote(reply) {
    if (!isAuthenticated) {
      openLoginForAction();
      return;
    }
    if (!reply?.id || pendingReplyVoteIdsRef.current.has(String(reply.id))) return;

    const replyKey = String(reply.id);
    const previousVoted = Boolean(reply.isUpvoted);
    const previousVoteCount = Number(reply.metrics?.upvoteCount || 0);
    const nextVoted = !previousVoted;
    const nextVoteCount = Math.max(0, previousVoteCount + (nextVoted ? 1 : -1));

    pendingReplyVoteIdsRef.current.add(replyKey);
    setActionError("");
    setThreadDetail((current) => {
      if (!current) return current;
      return {
        ...current,
        replies: (current.replies || []).map((item) =>
          String(item.id) === replyKey
            ? { ...item, voteCount: nextVoteCount, isUpvoted: nextVoted, viewerUpvoted: nextVoted }
            : item
        ),
      };
    });
    rememberRecentVoteMutation(`reply:${reply.id}`);

    try {
      const result = await toggleCommunityReplyVote(reply.id);
      setThreadDetail((current) => {
        if (!current) return current;
        return {
          ...current,
          replies: (current.replies || []).map((item) =>
            String(item.id) === String(reply.id)
              ? { ...item, voteCount: result.voteCount, isUpvoted: result.voted, viewerUpvoted: result.voted }
              : item
          ),
        };
      });
    } catch (err) {
      setThreadDetail((current) => {
        if (!current) return current;
        return {
          ...current,
          replies: (current.replies || []).map((item) =>
            String(item.id) === replyKey
              ? { ...item, voteCount: previousVoteCount, isUpvoted: previousVoted, viewerUpvoted: previousVoted }
              : item
          ),
        };
      });
      setActionError(err.response?.data?.error || err.response?.data?.message || "Could not update the reply vote.");
    } finally {
      pendingReplyVoteIdsRef.current.delete(replyKey);
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
      setPendingScrollReplyId(reply.id);
      showNotice("Accepted answer updated");
    } catch (err) {
      setActionError(err.response?.data?.error || err.response?.data?.message || "Could not mark this reply as the accepted answer.");
    } finally {
      setAcceptingReplyId(null);
    }
  }

  async function handleSubmitReport(event) {
    event.preventDefault();

    if (!reportTarget) return;

    const reason = reportReason.trim();
    if (!reason) {
      setReportError("Enter a reason before submitting.");
      return;
    }

    setIsReporting(true);
    setReportError("");

    try {
      await reportCommunityPost(normalizedDetail.rootPost.id, {
        reason,
        ...(reportTarget.type === "reply" ? { replyId: reportTarget.id } : {}),
      });
      setReportedKeys((current) => ({
        ...current,
        [buildReportKey(reportTarget.type, reportTarget.id)]: true,
      }));
      setReportTarget(null);
      setReportReason("");
      showNotice("Report submitted");
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || "Could not submit this report.";
      if (err.response?.status === 409 || message.toLowerCase().includes("already")) {
        setReportedKeys((current) => ({
          ...current,
          [buildReportKey(reportTarget.type, reportTarget.id)]: true,
        }));
        setReportTarget(null);
        setReportReason("");
        showNotice("You already reported this item", "info");
      } else {
        setReportError(message);
      }
    } finally {
      setIsReporting(false);
    }
  }

  if (isLoading) {
    return (
      <DetailSkeleton
        isAuthenticated={isAuthenticated}
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        isAuthenticated={isAuthenticated}
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
              loadThreadDetail();
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

  const rootReportKey = buildReportKey("post", normalizedDetail.rootPost.id);
  const rootMenuItems = [
    ...(isPostOwner ? [
      {
        id: "edit-post",
        label: "Edit post",
        onClick: () => setIsEditingPost(true),
      },
      {
        id: "delete-post",
        label: "Delete post",
        onClick: () => triggerDeletePost(normalizedDetail.rootPost),
      }
    ] : []),
    {
      id: "report-post",
      label: reportedKeys[rootReportKey] ? "Report submitted" : "Report post",
      disabled: Boolean(reportedKeys[rootReportKey]),
      onClick: () => openReportModal({
        type: "post",
        id: normalizedDetail.rootPost.id,
        summary: normalizedDetail.rootPost.title || normalizedDetail.rootPost.excerpt || "Untitled thread",
      }),
    },
  ];

  return (
    <CommunityPageShell
      isAuthenticated={isAuthenticated}
    >
      <CommunityReportModal
        isOpen={Boolean(reportTarget)}
        target={reportTarget}
        reason={reportReason}
        error={reportError}
        isSubmitting={isReporting}
        onReasonChange={setReportReason}
        onClose={() => {
          if (isReporting) return;
          setReportTarget(null);
          setReportReason("");
          setReportError("");
        }}
        onSubmit={handleSubmitReport}
      />

      <CommunityConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((current) => ({ ...current, isOpen: false }))}
        isDanger
      />


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

      {isEditingPost ? (
        <EditPostForm
          initialTitle={normalizedDetail.rootPost.title}
          initialBody={normalizedDetail.rootPost.content || normalizedDetail.rootPost.body}
          onSave={handleSaveEditPost}
          onCancel={() => setIsEditingPost(false)}
        />
      ) : (
        <CommunityThreadItem
          post={normalizedDetail.rootPost}
          isRootPost
          attachmentSlot={attachmentSlot}
          onReply={handleReplyToPost}
          onShare={handleShare}
          onUpvote={handlePostVote}
          menuItems={rootMenuItems}
          LinkComponent={Link}
          variant="light"
          showTitle={false}
          showCreatedMeta
        />
      )}

      <section className="flex items-center gap-4 rounded-xl border border-[#e4e0d8] bg-white px-5 py-3 shadow-sm">
        <span className="h-px flex-1 bg-[#e8e4dc]" />
        <h2 className="m-0 text-xs font-bold uppercase tracking-wider text-[#6b6660]">
          Replies ({normalizedDetail.replies.length})
        </h2>
        <span className="h-px flex-1 bg-[#e8e4dc]" />
      </section>

      <section className="grid gap-4">
        {normalizedDetail.replies.map((reply) => {
          const reportKey = buildReportKey("reply", reply.id);
          const isReplyOwner = Boolean(
            user?.id
              && reply.author?.id
              && String(user.id) === String(reply.author.id)
          );
          const replyMenuItems = [
            ...(isReplyOwner ? [
              {
                id: `edit-reply-${reply.id}`,
                label: "Edit comment",
                onClick: () => setEditingReply({ id: reply.id, body: reply.content || reply.body || "" }),
              },
              {
                id: `delete-reply-${reply.id}`,
                label: "Delete comment",
                onClick: () => triggerDeleteReply(reply),
              },
            ] : []),
            {
              id: `report-reply-${reply.id}`,
              label: reportedKeys[reportKey] ? "Report submitted" : "Report comment",
              disabled: Boolean(reportedKeys[reportKey]),
              onClick: () => openReportModal({
                type: "reply",
                id: reply.id,
                summary: reply.excerpt || reply.content || "Reply",
              }),
            },
          ];

          return (
            <div key={reply.id} id={`community-reply-${reply.id}`}>
              {editingReply?.id === reply.id ? (
                <EditReplyForm
                  initialBody={editingReply.body}
                  onSave={(body) => handleSaveEditReply(reply.id, body)}
                  onCancel={() => setEditingReply(null)}
                />
              ) : (
                <CommunityThreadItem
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
                  onReply={handleReplyToReply}
                  onParentReplyClick={handleParentReplyClick}
                  onShare={handleShare}
                  onUpvote={handleReplyVote}
                  menuItems={replyMenuItems}
                  LinkComponent={Link}
                  variant="light"
                  isHighlighted={String(highlightedReplyId) === String(reply.id)}
                />
              )}
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-[#e4e0d8] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-[#8c857e]">Join the discussion</p>
            <h2 className="mt-1 text-xl font-bold text-[#1a1a2e]">Your reply</h2>
          </div>
          {!isAuthLoading && !isAuthenticated ? (
            <Link
              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[#e8e4dc] px-4 text-xs font-bold text-[#4648d4] no-underline transition hover:border-[#4648d4] hover:bg-[#ede9fe]"
              to="/login"
              state={{ from: location }}
            >
              Log in to reply
            </Link>
          ) : null}
        </div>

        <form className="grid gap-3" onSubmit={handleSubmitReply}>
          {replyTarget ? (
            <div className="rounded-xl border border-[#e8e4dc] bg-[#faf8f5] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-sm font-bold text-[#1a1a2e]">
                    Replying to {getSafeText(replyTarget.author?.displayName) || getSafeText(replyTarget.author?.email, "Student")}
                    {replyTarget.index ? ` · #${replyTarget.index}` : ""}
                  </p>
                  {replyTarget.id ? (
                    <button
                      className="mt-1 border-0 bg-transparent p-0 text-left text-xs font-bold text-[#4648d4] transition hover:text-[#3537b8]"
                      onClick={() => focusReply(replyTarget.id)}
                      type="button"
                    >
                      Jump to original comment
                    </button>
                  ) : null}
                  {getSafeText(replyTarget.excerpt) ? (
                    <p className="mt-2 mb-0 text-sm leading-relaxed text-[#6b6660]">{getSafeText(replyTarget.excerpt)}</p>
                  ) : null}
                </div>
                <button
                  className="rounded-full border border-[#e8e4dc] bg-white px-3 py-1 text-xs font-bold text-[#6b6660] hover:border-[#4648d4] hover:text-[#4648d4] transition"
                  onClick={() => setReplyTarget(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#6b6660]">Your reply</span>
            <textarea
              ref={composerRef}
              className="min-h-[180px] w-full resize-y rounded-xl border border-[#e4e0d8] bg-[#faf8f5] px-4 py-3 text-[15px] leading-relaxed text-[#1a1a2e] outline-none transition placeholder:text-[#8c857e] focus:border-[#4648d4] focus:bg-white focus:shadow-[0_0_0_3px_rgba(70,72,212,0.12)] disabled:cursor-not-allowed disabled:border-[#e8e4dc] disabled:bg-[#f0ece4] disabled:text-[#8c857e]"
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
            <div className="rounded-xl border border-dashed border-[#e4e0d8] bg-[#faf8f5] px-4 py-3 text-xs text-[#6b6660]">
              Guests can read the thread and view previews. Log in to join the conversation.
            </div>
          ) : null}

          <div className="flex items-center justify-end">
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#4648d4] px-6 text-sm font-bold text-white transition hover:bg-[#3537b8] disabled:cursor-not-allowed disabled:bg-[#e8e4dc] disabled:text-[#8c857e]"
              type="submit"
              disabled={!isAuthenticated || isSubmitting || !replyBody.trim()}
            >
              {isSubmitting ? "Posting..." : "Post Reply"}
            </button>
          </div>
        </form>
      </section>
    </CommunityPageShell>
  );
}
