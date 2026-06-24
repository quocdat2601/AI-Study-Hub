const express = require('express');
const publicController = require('../controllers/public.controller');
const communityController = require('../controllers/community.controller');
const verifyToken = require('../middleware/auth');

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
router.get('/community', communityController.getHome);
router.get('/community/feed', communityController.getFeed);
router.get('/community/posts/:id', communityController.getPostById);
router.get('/community/subjects', communityController.getSubjects);
router.get('/community/users/:userId', communityController.getUserProfile);

// Public Documents Search, Details, Downloads, and Comments Routes
router.get('/documents', publicController.searchPublicDocuments);
router.get('/documents/:id', publicController.getPublicDocumentById);
router.get('/documents/:id/signed-url', publicController.getPublicDocumentSignedUrl);
router.get('/documents/:id/comments', publicController.listDocumentComments);
router.post('/documents/:id/comments', verifyToken, publicController.createDocumentComment);

module.exports = router;
