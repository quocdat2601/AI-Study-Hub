const router = require('express').Router();
const controller = require('../controllers/subject.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: List subjects
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subjects returned
 *       401:
 *         description: Missing, invalid, or expired token
 */
router.get('/', verifyToken, controller.listSubjects);

/**
 * @swagger
 * /api/subjects:
 *   post:
 *     summary: Create a subject
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Software Engineering
 *               code:
 *                 type: string
 *                 example: SWP391
 *               description:
 *                 type: string
 *                 example: Software Development Project
 *     responses:
 *       201:
 *         description: Subject created
 *       400:
 *         description: Missing subject name or code
 *       401:
 *         description: Missing, invalid, or expired token
 *       403:
 *         description: Admin role required
 *       409:
 *         description: Subject code already exists
 */
router.post('/', verifyToken, requireRole('admin'), controller.createSubject);

/**
 * @swagger
 * /api/subjects/{id}:
 *   patch:
 *     summary: Update a subject
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subject ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Software Engineering
 *               code:
 *                 type: string
 *                 example: SWP391
 *               description:
 *                 type: string
 *                 example: Software Development Project
 *     responses:
 *       200:
 *         description: Subject updated
 *       400:
 *         description: Missing subject name or code
 *       401:
 *         description: Missing, invalid, or expired token
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Subject not found
 *       409:
 *         description: Subject code already exists
 */
router.patch('/:id', verifyToken, requireRole('admin'), controller.updateSubject);

/**
 * @swagger
 * /api/subjects/{id}:
 *   delete:
 *     summary: Delete an unused subject
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subject ID
 *     responses:
 *       204:
 *         description: Subject deleted
 *       400:
 *         description: Cannot delete a subject with assigned documents
 *       401:
 *         description: Missing, invalid, or expired token
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Subject not found
 */
router.delete('/:id', verifyToken, requireRole('admin'), controller.deleteSubject);

module.exports = router;
