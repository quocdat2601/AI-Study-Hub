const router = require('express').Router();
const notificationController = require('../controllers/notification.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const MEMBER_ROLES = requireRole.MEMBER_ROLES;

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: User notifications
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get all notifications + unread count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: List of notifications }
 */
router.get('/', verifyToken, requireRole(...MEMBER_ROLES), notificationController.getAllNotifications);

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Success }
 */
router.patch('/read-all', verifyToken, requireRole(...MEMBER_ROLES), notificationController.markAllRead);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark one notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Success }
 */
router.patch('/:id/read', verifyToken, requireRole(...MEMBER_ROLES), notificationController.markRead);

module.exports = router;
