const PLACEHOLDER_NAMES = new Set([
  "anonymous user",
  "người dùng ẩn danh",
  "anonymous",
  "google user",
  "user",
]);

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function isPlaceholderDisplayName(value) {
  const normalized = normalizeName(value);
  return !normalized || PLACEHOLDER_NAMES.has(normalized);
}

function nameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  return local.replace(/[._-]+/g, " ").trim();
}

export function getDisplayName(user) {
  const candidates = [
    user?.displayName,
    user?.display_name,
    user?.fullName,
    user?.full_name,
    user?.name,
  ];

  const resolved = candidates.find((candidate) => !isPlaceholderDisplayName(candidate));
  if (resolved) return String(resolved).trim();

  const fromEmail = nameFromEmail(user?.email);
  if (!isPlaceholderDisplayName(fromEmail)) return fromEmail;

  const handle = String(user?.handle || "").replace(/^@/, "").trim();
  if (handle) return handle;

  return "Student";
}

export function getUserHandle(user) {
  if (user?.handle) return user.handle.startsWith("@") ? user.handle : `@${user.handle}`;
  const base = user?.email?.split("@")[0] || "student";
  return `@${base.replace(/[._-]+/g, "_")}`;
}

export function getUserInitials(user) {
  const displayName = getDisplayName(user);
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

export function formatJoinDate(value) {
  if (!value) return "Joined recently";
  return `Joined ${new Date(value).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })}`;
}
