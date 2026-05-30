const router = require('express').Router();
const chatController = require('../controllers/chat.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

router.use(verifyToken, requireRole('student'));

router.get('/sessions', chatController.listSessions);
router.post('/sessions', chatController.createSession);
router.get('/sessions/:sessionId', chatController.getSession);
router.patch('/sessions/:sessionId', chatController.updateSession);
router.delete('/sessions/:sessionId', chatController.deleteSession);

router.post('/sessions/:sessionId/documents', chatController.addDocument);
router.delete('/sessions/:sessionId/documents/:docId', chatController.removeDocument);

router.get('/sessions/:sessionId/messages', chatController.getMessages);
router.post('/sessions/:sessionId/messages', chatController.sendMessage);

module.exports = router;
