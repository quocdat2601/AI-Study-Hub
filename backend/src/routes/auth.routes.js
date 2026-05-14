const router = require('express').Router();
const controller = require('../controllers/auth.controller');

/**
 * @swagger
 * /api/auth:
 *   get:
 *     summary: Auth placeholder
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Auth route placeholder
 */
router.get('/', controller.placeholder);

module.exports = router;
