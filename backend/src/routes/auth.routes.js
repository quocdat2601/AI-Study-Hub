const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const verifyToken = require('../middleware/auth');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a student account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: student@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: Student123
 *     responses:
 *       201:
 *         description: Account created
 *       400:
 *         description: Invalid email or password
 *       409:
 *         description: Email already registered
 */
router.post('/register', controller.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: student@example.com
 *               password:
 *                 type: string
 *                 example: Student123
 *     responses:
 *       200:
 *         description: JWT token and user profile returned
 *       401:
 *         description: Invalid email or password
 *       403:
 *         description: Account suspended
 */
router.post('/login', controller.login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Missing, invalid, or expired token
 */
router.get('/me', verifyToken, controller.me);

module.exports = router;
