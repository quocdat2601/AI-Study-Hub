import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CommunityFeedRow from "../components/community/CommunityFeedRow.jsx";
import CommunityPageShell from "../components/community/CommunityPageShell.jsx";
import CommunityAvatar from "../components/community/CommunityAvatar.jsx";
import { formatForumDate, formatCount } from "../components/community/communityUtils.js";
import { normalizeThreadPost } from "../components/community/communityThreadViewModel.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getUserCommunityProfile } from "../services/communityApi.js";

function StatCard({ label, value, accent }) {
  return (
    <div className="flex flex-col items-center justify-center bg-white px-6 py-5">
      <span className={`text-2xl font-extrabold ${accent || "text-[#1a1a2e]"}`}>{formatCount(value)}</span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#8c857e]">{label}</span>
    </div>
  );
}

export default function CommunityUserProfilePage() {
  const { userId } = useParams();
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    getUserCommunityProfile(userId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || "Could not load this user's profile.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId]);

  if (isLoading) {
    return (
      <CommunityPageShell isAuthenticated={isAuthenticated}>
        <div className="grid gap-4">
          <div className="h-48 animate-pulse rounded-2xl border border-[#e4e0d8] bg-white" />
          <div className="h-32 animate-pulse rounded-2xl border border-[#e4e0d8] bg-white" />
          <div className="h-32 animate-pulse rounded-2xl border border-[#e4e0d8] bg-white" />
        </div>
      </CommunityPageShell>
    );
  }

  if (error) {
    return (
      <CommunityPageShell isAuthenticated={isAuthenticated}>
        <div className="rounded-xl border border-[#fecaca] bg-[#fff7f7] px-5 py-4 text-sm font-bold text-[#991b1b]">{error}</div>
        <Link to="/community" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#4648d4] hover:underline no-underline">
          ← Back to Community
        </Link>
      </CommunityPageShell>
    );
  }

  if (!profile) return null;

  const { user, stats, recentPosts } = profile;
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Anonymous";
  const joinedAt = user?.joinedAt;

  return (
    <CommunityPageShell isAuthenticated={isAuthenticated}>
      <div className="flex items-center gap-2 text-sm text-[#6b6660]">
        <Link to="/community" className="font-bold text-[#4648d4] hover:underline no-underline">Community</Link>
        <span className="text-[#8c857e]">/</span>
        <span className="font-semibold text-[#1a1a2e]">{displayName}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e4e0d8] bg-white shadow-sm">
        <div className="flex flex-col items-center gap-4 px-6 py-8 text-center sm:flex-row sm:text-left">
          <CommunityAvatar
            avatarUrl={user?.avatarUrl}
            displayName={displayName}
            email={user?.email}
            variant="light"
            className="h-20 w-20 flex-none rounded-full border-2 border-[#e8e4dc]"
          />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-xl font-bold text-[#1a1a2e]">{displayName}</h1>
            {user?.email ? (
              <p className="mt-1 text-sm text-[#6b6660]">@{user.email.split("@")[0]}</p>
            ) : null}
            {joinedAt ? (
              <p className="mt-2 text-xs text-[#8c857e]">Member since {formatForumDate(joinedAt)}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {(user?.roleBadges || []).map((badge, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded border border-[#e8e4dc] bg-[#f0ece4] px-2 py-0.5 text-xs font-bold text-[#6b6660]"
                >
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-[#e8e4dc] border-t border-[#e8e4dc]">
          <StatCard label="Posts" value={stats.postCount} accent="text-[#1a1a2e]" />
          <StatCard label="Reputation" value={stats.utilityPoints} accent="text-[#4648d4]" />
          <StatCard label="Votes received" value={stats.totalVotesReceived} accent="text-[#16a34a]" />
        </div>
      </div>

      <div>
        <h2 className="m-0 mb-4 text-base font-bold text-[#1a1a2e]">Recent Posts</h2>
        {recentPosts.length ? (
          <div className="grid gap-4">
            {recentPosts.map((post) => (
              <CommunityFeedRow
                key={post.id}
                variant="light"
                LinkComponent={Link}
                showExcerpt={true}
                thread={normalizeThreadPost({
                  ...post,
                  href: `/community/posts/${post.id}`,
                  lastActivity: {
                    ...post.lastActivity,
                    href: post.lastActivity?.replyId
                      ? `/community/posts/${post.id}#community-reply-${post.lastActivity.replyId}`
                      : `/community/posts/${post.id}`,
                  },
                })}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#e4e0d8] bg-white px-6 py-10 text-center">
            <p className="m-0 text-sm text-[#6b6660]">This user hasn't posted anything yet.</p>
          </div>
        )}
      </div>
    </CommunityPageShell>
  );
}
