import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DashboardSidebar from "../components/dashboard/DashboardSidebar.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getDocumentSignedUrl } from "../services/documentApi.js";
import {
  acceptCommunityReply,
  createCommunityReply,
  getCommunityPost,
  reportCommunityPost,
  toggleCommunityPostVote,
  toggleCommunityReplyVote,
} from "../services/communityApi.js";

function getDisplayName(user) {
  if (user?.email) {
    return user.email.split("@")[0].replace(/[._-]+/g, " ");
  }
  return "Student";
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ReplyCard({ post, reply, isOwner, isAuthenticated, onAccept, onVote, onReport }) {
  return (
    <article className={reply.isAccepted
      ? "rounded-[22px] border border-[#b6e3c8] bg-[#f6fffa] p-5"
      : "rounded-[22px] border border-[#dbe3ed] bg-white p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong className="block text-sm text-[#172033]">{reply.author?.displayName || "Student"}</strong>
          <span className="text-xs text-[#66758a]">{formatDate(reply.createdAt)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {reply.isAccepted ? <span className="rounded-full bg-[#e8f5ee] px-3 py-1 text-xs font-extrabold text-[#087443]">Accepted Answer</span> : null}
          {isOwner && post.postType === "question" && !reply.isAccepted ? (
            <button className="rounded-full border border-[#0f766e] px-3 py-1 text-xs font-extrabold text-[#0f766e]" onClick={() => onAccept(reply.id)} type="button">
              Mark Accepted
            </button>
          ) : null}
          {isAuthenticated ? (
            <button className="rounded-full border border-[#dbe3ed] px-3 py-1 text-xs font-extrabold text-[#172033]" onClick={() => onVote(reply.id)} type="button">
              Upvote - {reply.voteCount}
            </button>
          ) : null}
          {isAuthenticated ? (
            <button className="rounded-full border border-[#dbe3ed] px-3 py-1 text-xs font-extrabold text-[#991b1b]" onClick={() => onReport(reply.id)} type="button">
              Report
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-4 mb-0 whitespace-pre-wrap text-sm leading-7 text-[#344154]">{reply.body}</p>
    </article>
  );
}

function LoginPromptModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(15,23,42,0.58)] px-4" role="dialog" aria-modal="true" aria-labelledby="community-login-title">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.28)]">
        <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-[#66758a]">Login Required</p>
        <h2 className="mt-3 mb-0 text-[28px] font-extrabold leading-[1.05] text-[#172033]" id="community-login-title">
          Sign in to open or save shared documents
        </h2>
        <p className="mt-4 mb-0 text-sm leading-6 text-[#526173]">
          Community summaries stay public, but file retrieval and document saving are only available to signed-in members.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="inline-flex items-center justify-center rounded-full bg-[#172033] px-5 py-3 text-sm font-extrabold text-white no-underline" to="/login">
            Log in
          </Link>
          <button className="inline-flex items-center justify-center rounded-full border border-[#dbe3ed] px-5 py-3 text-sm font-extrabold text-[#172033]" onClick={onClose} type="button">
            Stay here
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommunityPostPage() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [post, setPost] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [actionError, setActionError] = useState("");
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const displayName = getDisplayName(user);

  useEffect(() => {
    let isMounted = true;

    async function loadPost() {
      setIsLoading(true);
      setError("");
      try {
        const data = await getCommunityPost(id);
        if (isMounted) setPost(data);
      } catch (err) {
        if (isMounted) setError(err.response?.data?.error || "Could not load this community post.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPost();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const replies = useMemo(() => {
    if (!post?.replies) return [];
    return [...post.replies].sort((a, b) => {
      if (a.isAccepted && !b.isAccepted) return -1;
      if (!a.isAccepted && b.isAccepted) return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }, [post]);

  const isOwner = Boolean(isAuthenticated && user?.id && post?.author?.id && String(user.id) === String(post.author.id));
  const shellClass = isAuthenticated
    ? (isSidebarCollapsed
      ? "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [grid-template-columns:64px_minmax(0,1fr)]"
      : "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [grid-template-columns:224px_minmax(0,1fr)]")
    : "min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e]";
  const contentClass = isAuthenticated
    ? (isSidebarCollapsed ? "grid gap-6 px-5 py-7 lg:px-6" : "grid gap-6 p-8")
    : "mx-auto grid max-w-[1080px] gap-6 px-4 py-8 md:px-8";

  async function refreshPost(nextId = id) {
    const data = await getCommunityPost(nextId);
    setPost(data);
  }

  async function handleReplySubmit(event) {
    event.preventDefault();
    setIsSubmittingReply(true);
    setActionError("");
    try {
      await createCommunityReply(id, replyBody);
      setReplyBody("");
      await refreshPost();
    } catch (err) {
      setActionError(err.response?.data?.error || "Could not post your reply.");
    } finally {
      setIsSubmittingReply(false);
    }
  }

  async function handlePostVote() {
    setActionError("");
    try {
      await toggleCommunityPostVote(id);
      await refreshPost();
    } catch (err) {
      setActionError(err.response?.data?.error || "Could not update vote.");
    }
  }

  async function handleReplyVote(replyId) {
    setActionError("");
    try {
      await toggleCommunityReplyVote(replyId);
      await refreshPost();
    } catch (err) {
      setActionError(err.response?.data?.error || "Could not update reply vote.");
    }
  }

  async function handleAccept(replyId) {
    setActionError("");
    try {
      await acceptCommunityReply(id, replyId);
      await refreshPost();
    } catch (err) {
      setActionError(err.response?.data?.error || "Could not accept this reply.");
    }
  }

  async function handleReport(replyId = null) {
    const reason = window.prompt(replyId ? "Why are you reporting this reply?" : "Why are you reporting this post?");
    if (!reason) return;

    setActionError("");
    try {
      await reportCommunityPost(id, replyId ? { replyId, reason } : { reason });
      window.alert("Report submitted.");
    } catch (err) {
      setActionError(err.response?.data?.error || "Could not submit report.");
    }
  }

  async function handleOpenDocument() {
    if (!post?.documentAttachment?.id) return;

    setActionError("");
    try {
      const result = await getDocumentSignedUrl(post.documentAttachment.id, {
        suppressAuthRedirect: true,
      });
      if (result?.signedUrl) {
        window.open(result.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setIsLoginPromptOpen(true);
        return;
      }
      setActionError(err.response?.data?.error || "Could not open this document.");
    }
  }

  return (
    <main className={shellClass}>
      <LoginPromptModal isOpen={isLoginPromptOpen} onClose={() => setIsLoginPromptOpen(false)} />
      {isAuthenticated ? (
        <DashboardSidebar
          activeSection="community"
          isCollapsed={isSidebarCollapsed}
          onSectionChange={() => {}}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
          userName={displayName}
          newDocumentTo="/library"
          newDocumentLabel="Upload Document"
        />
      ) : null}

      <section className={contentClass}>
        <div className="flex items-center gap-3 text-sm text-[#66758a]">
          <Link className="font-extrabold text-[#4648d4] no-underline" to="/community">Community</Link>
          <span>/</span>
          <span>{post?.subject?.code || "Discussion"}</span>
        </div>

        {error ? <div className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-5 py-4 text-sm font-bold text-[#991b1b]">{error}</div> : null}
        {actionError ? <div className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-5 py-4 text-sm font-bold text-[#991b1b]">{actionError}</div> : null}

        {isLoading ? (
          <div className="h-[360px] rounded-[28px] border border-[#dbe3ed] bg-white animate-pulse" />
        ) : post ? (
          <div className="grid gap-6">
            <article className="rounded-[28px] border border-[#c7d2e2] bg-white p-6 shadow-[0_22px_50px_rgba(20,31,48,0.08)]">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="rounded-full bg-[#e8efff] px-3 py-1 text-[#4648d4]">{post.subject?.code || "General"}</span>
                <span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-[#42526a]">
                  {post.postType === "question" ? "Question" : post.postType === "document_share" ? "Document Share" : "AI Study Log"}
                </span>
                {post.solved ? <span className="rounded-full bg-[#e8f5ee] px-3 py-1 text-[#087443]">Solved</span> : null}
              </div>

              <h1 className="mt-4 mb-0 text-[34px] font-extrabold leading-[1.05] text-[#172033]">{post.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#66758a]">
                <strong className="text-[#172033]">{post.author?.displayName || "Student"}</strong>
                <span>{formatDate(post.createdAt)}</span>
                <span>{post.voteCount} votes</span>
                <span>{post.replyCount} replies</span>
              </div>
              <p className="mt-6 mb-0 whitespace-pre-wrap text-[15px] leading-8 text-[#344154]">{post.body}</p>

              {post.documentAttachment ? (
                <div className="mt-6 rounded-[24px] border border-[#dbe3ed] bg-[#f9fbff] p-5">
                  <div className="flex flex-col gap-4 md:flex-row">
                    {post.documentAttachment.thumbnailUrl ? (
                      <img className="h-32 w-24 rounded-xl border border-[#dbe3ed] object-cover" src={post.documentAttachment.thumbnailUrl} alt="" />
                    ) : (
                      <div className="flex h-32 w-24 items-end justify-center rounded-xl border border-[#dbe3ed] bg-white pb-3 text-sm font-black text-[#4648d4]">
                        {post.documentAttachment.fileType}
                      </div>
                    )}
                    <div className="flex-1">
                      <strong className="block text-base text-[#172033]">{post.documentAttachment.fileName || post.documentAttachment.title}</strong>
                      <span className="mt-1 block text-sm text-[#66758a]">{post.documentAttachment.subjectCode || post.documentAttachment.subject || "Study Resource"}</span>
                      <p className="mt-3 mb-0 text-sm leading-7 text-[#526173]">{post.documentAttachment.abstractPreview || post.documentAttachment.previewText}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button className="inline-flex rounded-full bg-[#172033] px-4 py-2 text-sm font-extrabold text-white" onClick={handleOpenDocument} type="button">
                          Open Document
                        </button>
                        <span className="text-xs font-bold text-[#66758a]">
                          {post.documentAttachment.fileSizeBytes ? `${Math.max(1, Math.round(post.documentAttachment.fileSizeBytes / 1024))} KB` : "Protected file"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {post.chatAttachment ? (
                <div className="mt-6 rounded-[24px] border border-[#dbe3ed] bg-[#fffaf0] p-5">
                  <strong className="block text-base text-[#172033]">{post.chatAttachment.session.title}</strong>
                  <div className="mt-4 grid gap-3">
                    {(post.chatAttachment.messages || []).map((message) => (
                      <div className={message.role === "assistant"
                        ? "rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-[#344154]"
                        : "rounded-2xl bg-[#172033] px-4 py-3 text-sm leading-7 text-white"} key={message.id}>
                        <strong className="mb-1 block text-[11px] uppercase tracking-[0.1em] opacity-70">{message.role}</strong>
                        {message.content}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3 border-t border-[#eef2f7] pt-5">
                {isAuthenticated ? (
                  <button className="rounded-full border border-[#dbe3ed] px-4 py-2 text-sm font-extrabold text-[#172033]" onClick={handlePostVote} type="button">
                    Upvote Post
                  </button>
                ) : null}
                {isAuthenticated ? (
                  <button className="rounded-full border border-[#dbe3ed] px-4 py-2 text-sm font-extrabold text-[#991b1b]" onClick={() => handleReport()} type="button">
                    Report Post
                  </button>
                ) : null}
              </div>
            </article>

            <section className="grid gap-4">
              <div className="flex items-center justify-between">
                <h2 className="m-0 text-2xl font-extrabold text-[#172033]">Replies</h2>
                <span className="text-sm text-[#66758a]">{replies.length} total</span>
              </div>

              {replies.length ? replies.map((reply) => (
                <ReplyCard
                  isAuthenticated={isAuthenticated}
                  isOwner={isOwner}
                  key={reply.id}
                  onAccept={handleAccept}
                  onReport={handleReport}
                  onVote={handleReplyVote}
                  post={post}
                  reply={reply}
                />
              )) : (
                <div className="rounded-[24px] border border-dashed border-[#c7d2e2] bg-white px-6 py-8 text-sm text-[#66758a]">
                  No replies yet. Start the conversation.
                </div>
              )}
            </section>

            {isAuthenticated ? (
              <form className="rounded-[24px] border border-[#dbe3ed] bg-white p-5 shadow-[0_18px_40px_rgba(20,31,48,0.06)]" onSubmit={handleReplySubmit}>
                <h2 className="m-0 text-xl font-extrabold text-[#172033]">Add Reply</h2>
                <textarea
                  className="mt-4 min-h-[160px] w-full rounded-[22px] border border-[#dbe3ed] px-4 py-4 text-sm leading-7 text-[#172033]"
                  onChange={(event) => setReplyBody(event.target.value)}
                  placeholder="Write a clear explanation, next step, or answer."
                  required
                  value={replyBody}
                />
                <button className="mt-4 inline-flex rounded-full bg-[#172033] px-5 py-3 text-sm font-extrabold text-white" disabled={isSubmittingReply} type="submit">
                  {isSubmittingReply ? "Posting..." : "Post Reply"}
                </button>
              </form>
            ) : (
              <div className="rounded-[24px] border border-[#dbe3ed] bg-white px-6 py-5 text-sm text-[#66758a]">
                <Link className="font-extrabold text-[#4648d4] no-underline" to="/login">Log in</Link> to reply, vote, or report content.
              </div>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
