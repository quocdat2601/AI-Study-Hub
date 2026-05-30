const router = require('express').Router();
const documentController = require('../controllers/document.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const upload = require('../middleware/upload');

/**
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document management API
 */

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: List owned + shared documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by title
 *       - in: query
 *         name: subjectId
 *         schema: { type: integer }
 *         description: Filter by subject
 *     responses:
 *       200: { description: List of documents }
 *       401: { description: Unauthorized }
 */
router.get('/', verifyToken, documentController.getAllDocuments);

/**
 * @swagger
 * /api/documents:
 *   post:
 *     summary: Upload document (multipart/form-data)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               title: { type: string }
 *               subjectId: { type: integer }
 *     responses:
 *       201: { description: Uploaded }
 *       400: { description: Bad request }
 *       403: { description: Forbidden (Students or admins only) }
 */
router.post('/', verifyToken, requireRole('student', 'admin'), upload.single('file'), documentController.uploadDocument);

/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Get one document (owner or shared)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Document details }
 *       404: { description: Not found }
 */
router.get('/:id', verifyToken, documentController.getDocumentById);

/**
 * @swagger
 * /api/documents/{id}/signed-url:
 *   get:
 *     summary: Get Supabase signed download URL
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Signed URL }
 *       404: { description: File not found }
 */
router.get('/:id/signed-url', verifyToken, documentController.getSignedUrl);

module.exports = router;
