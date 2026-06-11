const router = require('express').Router();
const aiController = require('../controllers/ai.controller');
const verifyToken = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: Temporary AI document Q&A endpoints
 */

router.use(verifyToken);

/**
 * @swagger
 * /api/ai/models/status:
 *   get:
 *     summary: Get Gemini and Ollama model availability
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Model status returned }
 *       401: { description: Unauthorized }
 */
router.get('/models/status', aiController.getModelStatus);

/**
 * @swagger
 * /api/ai/usage:
 *   get:
 *     summary: Get local Gemini usage for selected model
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: model
 *         schema: { type: string }
 *     responses:
 *       200: { description: Usage returned }
 *       400: { description: Model is not allowed }
 *       401: { description: Unauthorized }
 */
router.get('/usage', aiController.getUsage);

/**
 * @swagger
 * /api/ai/documents/{id}/process:
 *   post:
 *     summary: Extract and chunk a text-based PDF for RAG
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Document processed }
 *       400: { description: Unsupported or unreadable document }
 *       401: { description: Unauthorized }
 *       404: { description: Document not found }
 */
router.post('/documents/:id/process', aiController.processDocument);

/**
 * @swagger
 * /api/ai/documents/{id}/ask:
 *   post:
 *     summary: Ask Gemini a question using retrieved document chunks
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question]
 *             properties:
 *               question: { type: string }
 *               mode:
 *                 type: string
 *                 enum: [hybrid, document_only]
 *                 default: hybrid
 *               model:
 *                 type: string
 *                 description: Gemini model from backend allowlist
 *     responses:
 *       200: { description: Gemini answer with source chunks }
 *       400: { description: Invalid question or unreadable document }
 *       401: { description: Unauthorized }
 *       404: { description: Document not found }
 */
router.post('/documents/:id/ask', aiController.askDocument);

module.exports = router;
