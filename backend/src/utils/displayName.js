const PLACEHOLDER_NAMES = new Set([
  'anonymous user',
  'người dùng ẩn danh',
  'anonymous',
  'google user',
  'user',
]);

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function isPlaceholderDisplayName(value) {
  const normalized = normalizeName(value);
  return !normalized || PLACEHOLDER_NAMES.has(normalized);
}

function nameFromEmail(email) {
  const local = String(email || '').split('@')[0] || '';
  return local.replace(/[._-]+/g, ' ').trim();
}

function extractAuthDisplayName(authUser) {
  const meta = authUser?.user_metadata || authUser?.raw_user_meta_data || {};
  const candidates = [
    meta.full_name,
    meta.name,
    meta.display_name,
    [meta.given_name, meta.family_name].filter(Boolean).join(' '),
  ];

  return candidates.find((candidate) => !isPlaceholderDisplayName(candidate))?.trim() || null;
}

function resolveDisplayName({
  displayName,
  display_name,
  name,
  fullName,
  full_name,
  email,
  handle,
}) {
  const candidates = [displayName, display_name, fullName, full_name, name];
  const resolved = candidates.find((candidate) => !isPlaceholderDisplayName(candidate));
  if (resolved) return String(resolved).trim();

  const fromEmail = nameFromEmail(email);
  if (!isPlaceholderDisplayName(fromEmail)) return fromEmail;

  const cleanHandle = String(handle || '').replace(/^@/, '').trim();
  if (cleanHandle) return cleanHandle;

  return 'Student';
}

module.exports = {
  isPlaceholderDisplayName,
  extractAuthDisplayName,
  resolveDisplayName,
  nameFromEmail,
};
