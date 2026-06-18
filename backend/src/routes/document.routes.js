const router = require('express').Router();
const documentController = require('../controllers/document.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const requireDocumentOwner = require('../middleware/requireDocumentOwner');

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
 * /api/documents/trash:
 *   get:
 *     summary: List soft-deleted documents (trash) of current user
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: List of trashed documents }
 *       401: { description: Unauthorized }
 */
router.get('/trash', verifyToken, documentController.listTrash);

/**
 * @swagger
 * /api/documents/trash/empty:
 *   post:
 *     summary: Empty trash — permanently delete all own trashed documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Trash emptied }
 */
router.post('/trash/empty', verifyToken, requireRole('student', 'admin'), documentController.emptyTrash);

/**
 * @swagger
 * /api/documents/bulk-delete:
 *   post:
 *     summary: Soft-delete multiple documents at once
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids: { type: array, items: { type: integer } }
 *     responses:
 *       200: { description: Bulk soft-delete result }
 */
router.post('/bulk-delete', verifyToken, requireRole('student', 'admin'), documentController.bulkSoftDelete);

/**
 * @swagger
 * /api/documents/bulk-restore:
 *   post:
 *     summary: Restore multiple documents from trash at once
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids: { type: array, items: { type: integer } }
 *     responses:
 *       200: { description: Bulk restore result }
 */
router.post('/bulk-restore', verifyToken, requireRole('student', 'admin'), documentController.bulkRestore);

/**
 * @swagger
 * /api/documents/purge-expired:
 *   post:
 *     summary: Manually run auto-purge of expired trash (admin only — for testing)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Auto-purge result }
 *       403: { description: Forbidden (admin only) }
 */
router.post('/purge-expired', verifyToken, requireRole('admin'), documentController.purgeExpiredTrash);

/**
 * @swagger
 * /api/documents/deletion-logs:
 *   get:
 *     summary: Admin views document deletion/restore history (metadata only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deletion history }
 *       403: { description: Forbidden (admin only) }
 */
router.get('/deletion-logs', verifyToken, requireRole('admin'), documentController.getDeletionLogs);

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

/**
 * @swagger
 * /api/documents/{id}/shares:
 *   get:
 *     summary: List active shares for a document (owner or admin)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Share document with another user by email
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 */
router.get(
  '/:id/shares',
  verifyToken,
  requireRole('student', 'admin'),
  requireDocumentOwner(),
  documentController.listDocumentShares
);

router.post(
  '/:id/shares',
  verifyToken,
  requireRole('student', 'admin'),
  requireDocumentOwner(),
  documentController.shareDocument
);

/**
 * @swagger
 * /api/documents/{id}/shares/{shareId}:
 *   delete:
 *     summary: Revoke a document share
 *     tags: [Documents]
 */
router.delete(
  '/:id/shares/:shareId',
  verifyToken,
  requireRole('student', 'admin'),
  requireDocumentOwner(),
  documentController.revokeDocumentShare
);

router.patch(
  '/:id/visibility',
  verifyToken,
  requireRole('student', 'admin'),
  requireDocumentOwner(),
  documentController.updateDocumentVisibility
);

/**
 * @swagger
 * /api/documents/{id}:
 *   patch:
 *     summary: Update document title or subject (owner or admin)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               subjectId: { type: integer, nullable: true }
 *               tags: { type: string, description: Comma-separated tag names }
 *     responses:
 *       200: { description: Updated }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.patch(
  '/:id',
  verifyToken,
  requireRole('student', 'admin'),
  requireDocumentOwner(),
  documentController.updateDocument
);

router.post(
  '/:id/ocr-text',
  verifyToken,
  requireRole('student', 'admin'),
  requireDocumentOwner(),
  documentController.saveOcrText
);

/**
 * @swagger
 * /api/documents/{id}:
 *   delete:
 *     summary: Delete document from database and storage (owner or admin)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.delete(
  '/:id',
  verifyToken,
  requireRole('student', 'admin'),
  requireDocumentOwner(),
  documentController.deleteDocument
);

/**
 * @swagger
 * /api/documents/{id}/restore:
 *   post:
 *     summary: Restore a soft-deleted document from trash (owner or admin)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Document restored }
 *       403: { description: Forbidden }
 *       404: { description: Document not found in trash }
 */
router.post(
  '/:id/restore',
  verifyToken,
  requireRole('student', 'admin'),
  documentController.restoreDocument
);

/**
 * @swagger
 * /api/documents/{id}/purge:
 *   delete:
 *     summary: Permanently delete a document (owner of own doc, or admin)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Document permanently deleted }
 *       403: { description: Forbidden }
 *       404: { description: Document not found }
 */
router.delete(
  '/:id/purge',
  verifyToken,
  requireRole('student', 'admin'),
  documentController.purgeDocument
);

module.exports = router;
