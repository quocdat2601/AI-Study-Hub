const router = require('express').Router();
const roadMapController = require('../controllers/roadmap.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const member = [verifyToken, requireRole('student', 'admin')];

/**
 * RoadMap APIs (per user per document)
 * - GET    /api/roadmap/documents/:id
 * - POST   /api/roadmap/documents/:id/generate
 * - PATCH  /api/roadmap/documents/:id/tasks/:taskId
 */

router.get('/documents/:id', ...member, roadMapController.getRoadMap);
router.post('/documents/:id/generate', ...member, roadMapController.generateRoadMap);
router.patch('/documents/:id/tasks/:taskId', ...member, roadMapController.updateTaskStatus);

module.exports = router;

