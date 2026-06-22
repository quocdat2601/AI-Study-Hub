const crypto = require('crypto');
const supabaseService = require('./supabase.service');
const documentModel = require('../models/document.model');
const userModel = require('../models/user.model');
const createError = require('../utils/createError');

const COMMUNITY_IMAGE_FOLDER = 'community-images';
const SIGNED_URL_TTL = 60 * 60 * 24 * 365;

async function uploadCommunityImage(file, userId) {
  const user = await userModel.findById(userId);
  if (!user) throw createError(404, 'User not found');

  const usedBytes = await documentModel.sumStorageByUserId(userId);
  const limitBytes = Number(user.storage_limit_bytes || 0);
  if (usedBytes + file.size > limitBytes) {
    const usedMB = Math.round(usedBytes / 1024 / 1024);
    const limitMB = Math.round(limitBytes / 1024 / 1024);
    throw createError(400, `Storage limit exceeded. ${usedMB} MB / ${limitMB} MB`);
  }

  const ext = file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const uniqueName = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  const storagePath = `${COMMUNITY_IMAGE_FOLDER}/${userId}/${uniqueName}`;

  await supabaseService.uploadFile(file.buffer, storagePath, file.mimetype);

  await documentModel.createCloudFile({
    storage_path: storagePath,
    mime_type: file.mimetype,
    size_bytes: file.size,
  });

  const url = await supabaseService.getSignedUrl(storagePath, SIGNED_URL_TTL);

  return { url, path: storagePath };
}

module.exports = { uploadCommunityImage };
