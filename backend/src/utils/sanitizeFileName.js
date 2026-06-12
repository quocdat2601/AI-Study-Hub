const path = require('path');
const crypto = require('crypto');

/**
 * Supabase Storage keys only accept safe ASCII paths.
 * Keep the original name for document.title, not for storage_path.
 */
function buildSafeStorageFileName(originalName) {
  const ext = path.extname(originalName || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  const safeExt = ext && ext.startsWith('.') ? ext : '.bin';
  const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  return `${unique}${safeExt}`;
}

module.exports = { buildSafeStorageFileName };
