const router = require('express').Router();
const accountController = require('../controllers/account.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const uploadAvatar = require('../middleware/uploadAvatar');

/**
 * @swagger
 * tags:
 *   name: Account
 *   description: User account profile and settings
 */

/**
 * @swagger
 * /api/account:
 *   get:
 *     summary: Get account profile, storage, preferences and activity
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Account data }
 */
router.get('/', verifyToken, requireRole('user', 'admin'), accountController.getAccount);

/**
 * @swagger
 * /api/account/profile:
 *   patch:
 *     summary: Update display name, handle and major
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/profile', verifyToken, requireRole('user', 'admin'), accountController.updateProfile);

/**
 * @swagger
 * /api/account/preferences:
 *   patch:
 *     summary: Update theme and language
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/preferences', verifyToken, requireRole('user', 'admin'), accountController.updatePreferences);

/**
 * @swagger
 * /api/account/email:
 *   patch:
 *     summary: Update account email
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/email', verifyToken, requireRole('user', 'admin'), accountController.updateEmail);

/**
 * @swagger
 * /api/account/password:
 *   patch:
 *     summary: Change account password
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/password', verifyToken, requireRole('user', 'admin'), accountController.updatePassword);

router.post(
  '/avatar',
  verifyToken,
  requireRole('user', 'admin'),
  uploadAvatar.single('avatar'),
  accountController.uploadAvatar
);

router.post('/storage/upgrade', verifyToken, requireRole('user', 'admin'), accountController.upgradeStorage);

module.exports = router;
