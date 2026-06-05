const express = require('express');
const publicController = require('../controllers/public.controller');

const router = express.Router();

/**
 * @swagger
 * /api/public/documents/trending:
 *   get:
 *     summary: List trending public documents
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Maximum number of documents to return
 *     responses:
 *       200:
 *         description: Trending documents returned
 */
router.get('/documents/trending', publicController.getTrendingDocuments);
router.get('/chat-shares/:token', publicController.getPublicChatShare);

module.exports = router;
