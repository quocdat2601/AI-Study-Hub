const crypto = require('crypto');
const supabaseService = require('../services/supabase.service');

const COMMUNITY_IMAGE_BUCKET_PREFIX = 'community-images';

async function uploadImage(req, res) {
  const { file, user } = req;

  if (!file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const ext = file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const uniqueName = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  const storagePath = `${COMMUNITY_IMAGE_BUCKET_PREFIX}/${user.id}/${uniqueName}`;

  try {
    await supabaseService.uploadFile(file.buffer, storagePath, file.mimetype);
    const signedUrl = await supabaseService.getSignedUrl(storagePath, 60 * 60 * 24 * 365);

    return res.status(201).json({ url: signedUrl, path: storagePath });
  } catch (err) {
    const message = err.publicMessage || err.message || 'Image upload failed';
    return res.status(500).json({ error: message });
  }
}

module.exports = { uploadImage };
