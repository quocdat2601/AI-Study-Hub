const router = require('express').Router();
const workspaceController = require('../controllers/workspace.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const member = [verifyToken, requireRole('student', 'admin')];

router.get('/bootstrap', ...member, workspaceController.getBootstrap);
router.get('/documents/:id', ...member, workspaceController.getDocumentContext);
router.get('/documents/:id/preview-data', ...member, workspaceController.getDocumentPreviewData);
router.get('/documents/:id/pdf', ...member, workspaceController.getDocumentPdf);
router.post('/sessions/:sessionId/messages', ...member, workspaceController.sendMessage);
router.post('/documents/:id/bookmark', ...member, workspaceController.addBookmark);
router.delete('/documents/:id/bookmark', ...member, workspaceController.removeBookmark);

module.exports = router;
