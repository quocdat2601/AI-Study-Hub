const router = require('express').Router();
const apiKeyController = require('../controllers/api-key.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

router.use(verifyToken, requireRole('user', 'admin'));

/**
 * POST /api/keys/save
 * Body: { rawKey: string }
 * Validates, encrypts, and stores a user API key.
 */
router.post('/save', apiKeyController.saveKey);

/**
 * GET /api/keys
 * Returns all saved keys for the authenticated user (masked values only).
 */
router.get('/', apiKeyController.listKeys);

/**
 * DELETE /api/keys/:provider
 * Removes the saved key for the given provider.
 */
router.delete('/:provider', apiKeyController.deleteKey);

module.exports = router;
