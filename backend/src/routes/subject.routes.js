const router = require('express').Router();
const controller = require('../controllers/subject.controller');

/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: Subjects placeholder
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subjects route placeholder
 */
router.get('/', controller.placeholder);

module.exports = router;
