export function getDisplayName(user) {
  if (user?.displayName) return user.displayName;
  if (user?.display_name) return user.display_name;
  if (user?.name) return user.name;
  if (user?.fullName) return user.fullName;
  if (user?.full_name) return user.full_name;
  if (user?.email) return user.email.split("@")[0].replace(/[._-]+/g, " ");
  return "Student";
}

export function getUserHandle(user) {
  if (user?.handle) return user.handle.startsWith("@") ? user.handle : `@${user.handle}`;
  const base = user?.email?.split("@")[0] || "student";
  return `@${base.replace(/[._-]+/g, "_")}`;
}

export function getUserInitials(user) {
  return getDisplayName(user).slice(0, 2).toUpperCase();
}

export function formatJoinDate(value) {
  if (!value) return "Joined recently";
  return `Joined ${new Date(value).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })}`;
}
