const communityImageService = require('../services/communityImage.service');

async function uploadImage(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    const result = await communityImageService.uploadCommunityImage(req.file, req.user.id);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadImage };
