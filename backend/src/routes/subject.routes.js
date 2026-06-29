const router = require('express').Router();
const subjectController = require('../controllers/subject.controller');
const verifyToken = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Subjects
 *   description: Subject management API
 */

/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: List all subjects (for dropdowns)
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: List of subjects }
 *       401: { description: Unauthorized }
 */
router.get('/', verifyToken, subjectController.getAllSubjects);

module.exports = router;
