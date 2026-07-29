const router = require('express').Router();
const adminController = require('../controllers/admin.controller');
const announcementController = require('../controllers/announcement.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative management
 */

// All routes here require Admin role
router.use(verifyToken, requireRole('admin'));

/**
 * @swagger
 * /api/admin/overview:
 *   get:
 *     summary: Admin dashboard overview metrics
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Overview metrics and chart data }
 */
router.get('/overview', adminController.getOverview);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of users }
 */
router.get('/users', adminController.getAllUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   patch:
 *     summary: Update user status or storage limit
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [active, disabled] }
 *               storage_limit_bytes: { type: integer }
 *     responses:
 *       200: { description: Updated }
 */
router.patch('/users/:id', adminController.updateUser);

/**
 * @swagger
 * /api/admin/subjects:
 *   get:
 *     summary: List all subjects
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of subjects }
 */
router.get('/subjects', adminController.getAllSubjects);

/**
 * @swagger
 * /api/admin/subjects:
 *   post:
 *     summary: Create subject
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               description: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.post('/subjects', adminController.createSubject);

/**
 * @swagger
 * /api/admin/subjects/{id}:
 *   patch:
 *     summary: Update subject
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               description: { type: string }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Subject not found }
 */
router.patch('/subjects/:id', adminController.updateSubject);

/**
 * @swagger
 * /api/admin/subjects/{id}:
 *   delete:
 *     summary: Delete subject
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 *       400: { description: Cannot delete a subject with assigned documents }
 *       404: { description: Subject not found }
 */
router.delete('/subjects/:id', adminController.deleteSubject);

/**
 * @swagger
 * /api/admin/activity-logs:
 *   get:
 *     summary: Paginated activity log
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of logs }
 */
router.get('/activity-logs', adminController.getActivityLogs);
router.get('/community/reports', adminController.getCommunityReports);
router.patch('/community/reports/:id', adminController.resolveCommunityReport);
router.patch('/community/posts/:id', adminController.moderateCommunityPost);
router.patch('/community/replies/:id', adminController.moderateCommunityReply);

/**
 * @swagger
 * /api/admin/documents:
 *   get:
 *     summary: List all documents on platform
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of documents }
 */
router.get('/documents', adminController.getAllDocuments);

/**
 * @swagger
 * /api/admin/ai-usage:
 *   get:
 *     summary: Get AI usage & cost monitoring statistics
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: AI Usage overview statistics }
 */
router.get('/ai-usage', adminController.getAiUsage);

/**
 * @swagger
 * /api/admin/announcements:
 *   post:
 *     summary: Broadcast a new system-wide or targeted announcement
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title: { type: string }
 *               message: { type: string }
 *               targetRole: { type: string, enum: [all, user, admin] }
 *     responses:
 *       201: { description: Announcement created }
 *   get:
 *     summary: Get historical announcements list with read count metrics
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of announcements }
 * /api/admin/announcements/{id}:
 *   delete:
 *     summary: Recall / delete an announcement
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 */
router.post('/announcements', announcementController.createAnnouncement);
router.get('/announcements', announcementController.listAnnouncements);
router.delete('/announcements/:id', announcementController.deleteAnnouncement);

module.exports = router;
