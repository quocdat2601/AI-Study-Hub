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
 * /api/ai/documents/{id}/overview/retry:
 *   post:
 *     summary: Regenerate a persisted document overview from existing chunks
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Overview regenerated or failed status persisted }
 *       400: { description: Document has no existing AI chunks or overview is disabled }
 *       401: { description: Unauthorized }
 *       404: { description: Document not found }
 *       409: { description: Overview generation is already in progress }
 */
router.post('/documents/:id/overview/retry', aiController.retryDocumentOverview);

/**
 * @swagger
 * /api/ai/documents/{id}/roadmap:
 *   get:
 *     summary: Get the persisted learning roadmap and the caller's step completion progress
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Roadmap (or null) with completed step orders returned }
 *       401: { description: Unauthorized }
 *       404: { description: Document not found }
 */
router.get('/documents/:id/roadmap', aiController.getDocumentRoadmap);

/**
 * @swagger
 * /api/ai/documents/{id}/roadmap/retry:
 *   post:
 *     summary: Regenerate a persisted document roadmap from existing chunks
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Roadmap regenerated or failed status persisted }
 *       400: { description: Document has no existing AI chunks or roadmap is disabled }
 *       401: { description: Unauthorized }
 *       404: { description: Document not found }
 *       409: { description: Roadmap generation is already in progress }
 */
router.post('/documents/:id/roadmap/retry', aiController.retryDocumentRoadmap);

/**
 * @swagger
 * /api/ai/documents/{id}/roadmap/steps/{stepOrder}:
 *   patch:
 *     summary: Mark a roadmap step as completed or not completed for the caller
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: stepOrder
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [completed]
 *             properties:
 *               completed: { type: boolean }
 *     responses:
 *       200: { description: Updated completed step orders returned }
 *       400: { description: stepOrder is invalid }
 *       401: { description: Unauthorized }
 *       404: { description: Document or roadmap not found }
 */
router.patch('/documents/:id/roadmap/steps/:stepOrder', aiController.toggleRoadmapStep);

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

/**
 * @swagger
 * /api/ai/documents/{id}/ask/stream:
 *   post:
 *     summary: Stream an AI answer using retrieved document chunks
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Server-sent events stream }
 */
router.post('/documents/:id/ask/stream', aiController.askDocumentStream);

/**
 * @swagger
 * /api/ai/chat/sessions/{sessionId}/ask:
 *   post:
 *     summary: Ask an AI question across active session attachments
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: AI answer with multi-document sources }
 *       401: { description: Unauthorized }
 *       404: { description: Owned chat session not found }
 */
router.post('/chat/sessions/:sessionId/ask', aiController.askSession);

/**
 * @swagger
 * /api/ai/chat/sessions/{sessionId}/ask/stream:
 *   post:
 *     summary: Stream an AI answer across active session attachments
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Server-sent events stream }
 */
router.post('/chat/sessions/:sessionId/ask/stream', aiController.askSessionStream);

/**
 * @swagger
 * /api/ai/materials:
 *   get:
 *     summary: Get all generated materials for a document
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: docId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of materials }
 */
router.get('/materials', aiController.getMaterials);

/**
 * @swagger
 * /api/ai/materials/generate:
 *   post:
 *     summary: Generate study materials (flashcard, quiz, mindmap)
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [docId, materialType]
 *             properties:
 *               docId: { type: integer }
 *               materialType: { type: string, enum: [flashcard, quiz, mindmap] }
 *               model: { type: string }
 *     responses:
 *       200: { description: Generated material }
 */
router.post('/materials/generate', aiController.generateMaterial);

/**
 * @swagger
 * /api/ai/materials/{id}:
 *   delete:
 *     summary: Delete a study material
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Material deleted }
 */
router.delete('/materials/:id', aiController.deleteMaterial);

module.exports = router;
