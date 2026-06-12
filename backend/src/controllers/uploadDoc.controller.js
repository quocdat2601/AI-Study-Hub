const uploadDocService = require('../services/uploadDoc.service');

/**
 * UploadDoc — nhận file từ form, gọi service upload.
 */
async function upload(req, res, next) {
  try {
    const result = await uploadDocService.upload({
      userId: req.user.id,
      file: req.file,
      title: req.body.title,
      subjectId: req.body.subjectId,
      tags: req.body.tags,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { upload };
