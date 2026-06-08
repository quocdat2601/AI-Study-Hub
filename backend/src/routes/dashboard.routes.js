const router = require('express').Router();
const dashboardController = require('../controllers/dashboard.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const MEMBER_ROLES = requireRole.MEMBER_ROLES;

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Student dashboard data
 */

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Storage stats + doc counts + recent uploads
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Dashboard data }
 */
router.get('/', verifyToken, requireRole(...MEMBER_ROLES), dashboardController.getDashboardData);

module.exports = router;
