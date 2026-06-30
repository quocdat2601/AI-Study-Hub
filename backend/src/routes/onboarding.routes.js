const router = require('express').Router();
const onboardingController = require('../controllers/onboarding.controller');
const verifyToken = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Onboarding
 *   description: Interest selection & document recommendations
 */

/**
 * @swagger
 * /api/onboarding/options:
 *   get:
 *     summary: Majors, suggested tags (by current major) and popular tags
 *     tags: [Onboarding]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Onboarding options }
 */
router.get('/options', verifyToken, onboardingController.getOptions);

/**
 * @swagger
 * /api/onboarding/suggested-tags:
 *   get:
 *     summary: Suggested tags for a major
 *     tags: [Onboarding]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: majorId
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Suggested tags }
 */
router.get('/suggested-tags', verifyToken, onboardingController.getSuggestedTags);

/**
 * @swagger
 * /api/onboarding/subjects:
 *   get:
 *     summary: Subjects for a major (filtered)
 *     tags: [Onboarding]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: majorId
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Subjects list }
 */
router.get('/subjects', verifyToken, onboardingController.getSubjects);

/**
 * @swagger
 * /api/onboarding/recommendations:
 *   get:
 *     summary: Recommended documents based on selected topics
 *     tags: [Onboarding]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Recommended documents with match reason }
 */
router.get('/recommendations', verifyToken, onboardingController.getRecommendations);

/**
 * @swagger
 * /api/onboarding:
 *   get:
 *     summary: Current onboarding status & preferences
 *     tags: [Onboarding]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Onboarding status }
 *   put:
 *     summary: Save onboarding (major, topics, goal)
 *     tags: [Onboarding]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               majorId: { type: integer }
 *               goal: { type: string, enum: [exam, project, self_study] }
 *               topics: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Saved }
 *       400: { description: Invalid input }
 */
router.get('/', verifyToken, onboardingController.getStatus);
router.put('/', verifyToken, onboardingController.save);

/**
 * @swagger
 * /api/onboarding/skip:
 *   post:
 *     summary: Skip onboarding (mark as onboarded without preferences)
 *     tags: [Onboarding]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Skipped }
 */
router.post('/skip', verifyToken, onboardingController.skip);

module.exports = router;
