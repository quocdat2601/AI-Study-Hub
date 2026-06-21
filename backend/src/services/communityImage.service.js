const crypto = require('crypto');
const supabaseService = require('./supabase.service');

const COMMUNITY_IMAGE_FOLDER = 'community-images';
const SIGNED_URL_TTL = 60 * 60 * 24 * 365;

async function uploadCommunityImage(file, userId) {
  const ext = file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const uniqueName = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  const storagePath = `${COMMUNITY_IMAGE_FOLDER}/${userId}/${uniqueName}`;

  await supabaseService.uploadFile(file.buffer, storagePath, file.mimetype);
  const url = await supabaseService.getSignedUrl(storagePath, SIGNED_URL_TTL);

  return { url, path: storagePath };
}

module.exports = { uploadCommunityImage };
