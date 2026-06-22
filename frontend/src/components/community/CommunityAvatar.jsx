import React from "react";
import { cx, getInitials } from "./communityUtils.js";

export default function CommunityAvatar({
  avatarUrl,
  displayName,
  email,
  className = "",
  variant = "light",
}) {
  const initials = getInitials(displayName, email);

  if (avatarUrl) {
    return <img className={cx("object-cover", className)} src={avatarUrl} alt={displayName || "User avatar"} loading="lazy" />;
  }

  return (
    <div
      className={cx(
        "flex items-center justify-center rounded-full font-black",
        variant === "light"
          ? "bg-[radial-gradient(circle_at_top,#7c3aed,#4648d4_60%,#1e1b4b)] text-white"
          : "bg-[radial-gradient(circle_at_top,#6b7280,#4b5563_60%,#1f2937)] text-[#fbfbfb]",
        className
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
