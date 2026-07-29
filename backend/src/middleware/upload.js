const multer = require('multer');

const allowedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/x-msword',
  'application/vnd.ms-word',
  'application/doc',
  'application/x-doc',
  'image/png',
  'image/jpeg',
  'image/tiff',
  'image/bmp',
  'text/plain',
];

const allowedExtensions = ['pdf', 'docx', 'doc', 'txt', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isMimeAllowed = allowedMimeTypes.includes(file.mimetype);
    const ext = file.originalname ? file.originalname.split('.').pop().toLowerCase() : '';
    const isExtAllowed = allowedExtensions.includes(ext);

    if (!isMimeAllowed && !isExtAllowed) {
      return cb(new Error('Only PDF, DOCX, DOC, TXT, PNG, JPEG, TIFF, and BMP files are accepted'));
    }
    cb(null, true);
  },
});

module.exports = upload;
