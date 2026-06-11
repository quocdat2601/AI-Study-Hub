export function cx(...values) {
  return values.filter(Boolean).join(" ");
}

export function getSafeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function getSafeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function pickObject(...values) {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
}

export function pickArray(...values) {
  return values.find(Array.isArray) || [];
}

export function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(getSafeNumber(value));
}

export function formatForumDate(value, { includeTime = false } = {}) {
  if (!value) return "Unknown";

  const parsedDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Unknown";

  const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  if (!includeTime) {
    return dateFormatter.format(parsedDate);
  }

  const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateFormatter.format(parsedDate)} ${timeFormatter.format(parsedDate)}`;
}

export function formatBytes(value) {
  const size = getSafeNumber(value);
  if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toFixed(1)} GB`;
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export function getInitials(displayName, email) {
  const source = getSafeText(displayName) || getSafeText(email) || "User";
  const sanitized = source.includes("@") ? source.split("@")[0] : source;
  const parts = sanitized
    .replace(/[-_.]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "U";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function getUserDisplayName(user, fallback = "Student") {
  if (user?.email) {
    return user.email.split("@")[0].replace(/[._-]+/g, " ");
  }

  return fallback;
}
