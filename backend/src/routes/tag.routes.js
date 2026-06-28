const router = require('express').Router();
const tagController = require('../controllers/tag.controller');
const verifyToken = require('../middleware/auth');

/**
 * @swagger
 * /api/tags:
 *   get:
 *     summary: List tags with document counts (for pickers/autocomplete)
 *     tags: [Tags]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of tags }
 */
router.get('/', verifyToken, tagController.listTags);

module.exports = router;
