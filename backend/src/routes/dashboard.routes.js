const router = require('express').Router();
const controller = require('../controllers/dashboard.controller');

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Dashboard placeholder
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard route placeholder
 */
router.get('/', controller.placeholder);

module.exports = router;
