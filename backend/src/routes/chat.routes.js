const router = require('express').Router();
const chatController = require('../controllers/chat.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

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
router.get('/session/:docId', verifyToken, requireRole('student'), chatController.getOrCreateSession);

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
router.get('/sessions/:sessionId/messages', verifyToken, chatController.getMessages);

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
router.post('/sessions/:sessionId/messages', verifyToken, chatController.sendMessage);

module.exports = router;
