const supabase = require('../config/supabase');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'documents';

function buildStorageError(error, publicMessage) {
  const err = new Error(error.message);
  err.publicMessage = publicMessage;
  err.statusCode = 500;
  return err;
}

async function uploadFile(buffer, storagePath, mimeType, options = {}) {
  const { upsert = false } = options;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert });

  if (error) {
    throw buildStorageError(error, 'Upload failed. Please try again');
  }

  return storagePath;
}

async function getSignedUrl(storagePath, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    throw buildStorageError(error, 'Could not generate download link');
  }

  return data.signedUrl;
}

async function fileExists(storagePath) {
  const normalizedPath = String(storagePath || '').replace(/^\/+/, '');
  if (!normalizedPath) return false;
  const separator = normalizedPath.lastIndexOf('/');
  const folder = separator === -1 ? '' : normalizedPath.slice(0, separator);
  const fileName = separator === -1 ? normalizedPath : normalizedPath.slice(separator + 1);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, { limit: 100, search: fileName });
  if (error) throw buildStorageError(error, 'Could not inspect file storage');
  return (data || []).some((item) => item.name === fileName);
}

async function downloadFileBlob(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);

  if (error) {
    throw buildStorageError(error, 'Could not download file');
  }

  return data;
}

async function downloadFile(storagePath) {
  const data = await downloadFileBlob(storagePath);
  return Buffer.from(await data.arrayBuffer());
}

async function deleteFile(storagePath) {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}

module.exports = { uploadFile, getSignedUrl, fileExists, downloadFile, downloadFileBlob, deleteFile };
