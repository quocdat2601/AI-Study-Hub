const router = require('express').Router();
const controller = require('../controllers/document.controller');

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: Documents placeholder
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Documents route placeholder
 */
router.get('/', controller.placeholder);

module.exports = router;
