const router = require('express').Router();
const uploadDocController = require('../controllers/uploadDoc.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const upload = require('../middleware/upload');

/**
 * @swagger
 * tags:
 *   name: UploadDoc
 *   description: Upload tài liệu (PDF, DOCX)
 */

/**
 * @swagger
 * /api/upload-doc:
 *   post:
 *     summary: Upload document (multipart/form-data)
 *     tags: [UploadDoc]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *               title: { type: string }
 *               subjectId: { type: integer }
 *               tags: { type: string, description: Comma-separated tag names }
 *     responses:
 *       201: { description: Uploaded }
 *       400: { description: Bad request }
 *       403: { description: Forbidden }
 */
router.post(
  '/',
  verifyToken,
  requireRole('student', 'admin'),
  upload.single('file'),
  uploadDocController.upload
);

module.exports = router;
