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
          ? "bg-[radial-gradient(circle_at_top,#4648d4,#2f3a90_60%,#172033)] text-white"
          : "bg-[radial-gradient(circle_at_top,#3a566f,#1e2f43_60%,#132030)] text-[#eff6ff]",
        className
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
