const multer = require('multer');

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, and GIF images are accepted'));
    }
    cb(null, true);
  },
});

module.exports = uploadImage;
