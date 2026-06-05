const supabase = require('../config/supabase');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'documents';

async function uploadFile(buffer, storagePath, mimeType, options = {}) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: Boolean(options.upsert) });

  if (error) {
    const err = new Error(error.message);
    err.publicMessage = 'Upload failed. Please try again';
    err.statusCode = 500;
    throw err;
  }

  return storagePath;
}

async function getSignedUrl(storagePath, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    const err = new Error(error.message);
    err.publicMessage = 'Could not generate download link';
    err.statusCode = 500;
    throw err;
  }

  return data.signedUrl;
}

async function deleteFile(storagePath) {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}

module.exports = { uploadFile, getSignedUrl, deleteFile };
