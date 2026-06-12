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

module.exports = { uploadFile, getSignedUrl, downloadFile, downloadFileBlob, deleteFile };
