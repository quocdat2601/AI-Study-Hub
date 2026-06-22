const router = require('express').Router();
const chatController = require('../controllers/chat.controller');
const verifyToken = require('../middleware/auth');
const upload = require('../middleware/upload');

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: AI Chat management
 */

/**
 * @swagger
 * /api/chat/session/{docId}:
 *   get:
 *     summary: Get or create chat session for document
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Session details }
 */
router.use(verifyToken);

router.get('/session/:docId', chatController.getOrCreateSession);

router.post('/sessions/:sessionId/documents', chatController.attachExistingDocument);
router.post(
  '/sessions/:sessionId/documents/upload',
  upload.single('file'),
  chatController.uploadSessionDocument
);
router.delete('/sessions/:sessionId/documents/:documentId', chatController.softDetachDocument);
router.post('/sessions/:sessionId/documents/:documentId/restore', chatController.restoreDocument);
router.post('/sessions/:sessionId/documents/:documentId/save-to-library', chatController.saveDocumentToLibrary);

/**
 * @swagger
 * /api/chat/sessions/{sessionId}/messages:
 *   get:
 *     summary: Get all messages in session
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of messages }
 */
router.get('/sessions/:sessionId/messages', chatController.getMessages);

/**
 * @swagger
 * /api/chat/sessions/{sessionId}/messages:
 *   post:
 *     summary: Send question -> get AI answer
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *     responses:
 *       200: { description: AI response }
 */
router.post('/sessions/:sessionId/messages', chatController.sendMessage);

router.post('/sessions/:sessionId/shares/users', chatController.shareSessionWithUser);
router.delete('/sessions/:sessionId/shares/users/:userId', chatController.removeUserShare);
router.post('/sessions/:sessionId/public-link', chatController.createPublicLink);
router.delete('/sessions/:sessionId/public-link', chatController.revokePublicLink);

module.exports = router;
