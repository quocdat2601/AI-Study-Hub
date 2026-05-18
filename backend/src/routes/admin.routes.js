const router = require('express').Router();
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/admin.controller');

router.use(verifyToken, requireRole('admin'));

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List platform users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users returned
 *       401:
 *         description: Missing, invalid, or expired token
 *       403:
 *         description: Admin role required
 */
router.get('/users', controller.listUsers);

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   patch:
 *     summary: Enable or disable a user account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, disabled]
 *                 example: disabled
 *     responses:
 *       200:
 *         description: User status updated
 *       400:
 *         description: Invalid status or self-status update
 *       401:
 *         description: Missing, invalid, or expired token
 *       403:
 *         description: Admin role required
 *       404:
 *         description: User not found
 */
router.patch('/users/:id/status', controller.updateUserStatus);

module.exports = router;
