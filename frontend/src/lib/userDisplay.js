const PLACEHOLDER_NAMES = new Set([
  "người dùng ẩn danh",
  "anonymous user",
  "anonymous",
  "guest",
  "user",
  "student",
]);

function isPlaceholderDisplayName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return !normalized || PLACEHOLDER_NAMES.has(normalized);
}

function formatEmailLocalPart(email) {
  return String(email || "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();
}

export function getDisplayName(user) {
  const candidates = [
    user?.displayName,
    user?.display_name,
    user?.name,
    user?.fullName,
    user?.full_name,
  ];

  for (const name of candidates) {
    if (name && !isPlaceholderDisplayName(name)) {
      return String(name).trim();
    }
  }

  const fromEmail = formatEmailLocalPart(user?.email);
  if (fromEmail && !isPlaceholderDisplayName(fromEmail)) {
    return fromEmail;
  }

  return "Student";
}

export function getUserHandle(user) {
  if (user?.handle) return user.handle.startsWith("@") ? user.handle : `@${user.handle}`;
  const base = user?.email?.split("@")[0] || "student";
  return `@${base.replace(/[._-]+/g, "_")}`;
}

export function getUserInitials(user) {
  const name = getDisplayName(user);
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

export function formatJoinDate(value) {
  if (!value) return "Joined recently";
  return `Joined ${new Date(value).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })}`;
}
