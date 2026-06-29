const router = require('express').Router();
const healthController = require('../controllers/health.controller');

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Server health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 */
router.get('/', healthController.healthCheck);

/**
 * @swagger
 * /api/health/db:
 *   get:
 *     summary: Database health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database is reachable
 *       500:
 *         description: Database connection failed
 */
router.get('/db', healthController.dbCheck);

module.exports = router;
