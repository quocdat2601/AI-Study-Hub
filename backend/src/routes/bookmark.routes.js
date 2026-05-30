const router = require('express').Router();
const bookmarkController = require('../controllers/bookmark.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

/**
 * @swagger
 * tags:
 *   name: Bookmarks
 *   description: Document bookmarks management
 */

/**
 * @swagger
 * /api/bookmarks:
 *   get:
 *     summary: List bookmarked documents
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: List of bookmarks }
 */
router.get('/', verifyToken, requireRole('student'), bookmarkController.getAllBookmarks);

/**
 * @swagger
 * /api/bookmarks/{docId}:
 *   post:
 *     summary: Add bookmark
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201: { description: Bookmarked }
 */
router.post('/:docId', verifyToken, requireRole('student'), bookmarkController.addBookmark);

/**
 * @swagger
 * /api/bookmarks/{docId}:
 *   delete:
 *     summary: Remove bookmark
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Removed }
 */
router.delete('/:docId', verifyToken, requireRole('student'), bookmarkController.removeBookmark);

module.exports = router;
