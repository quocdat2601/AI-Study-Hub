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
router.get('/documents/:id/notes', ...member, workspaceController.listNotes);
router.post('/documents/:id/notes', ...member, workspaceController.createNote);
router.patch('/documents/:id/notes/:noteId', ...member, workspaceController.updateNote);
router.delete('/documents/:id/notes/:noteId', ...member, workspaceController.deleteNote);

module.exports = router;
