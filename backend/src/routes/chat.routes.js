const router = require('express').Router();
const chatController = require('../controllers/chat.controller');
const snapshotController = require('../controllers/chat-snapshot.controller');
const verifyToken = require('../middleware/auth');
const upload = require('../middleware/upload');

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: AI Chat management
 */

/**
 * @swagger
 * /api/chat/session/{docId}:
 *   get:
 *     summary: Get or create chat session for document
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Session details }
 */
router.use(verifyToken);

// Session lists are owned by their root document; attachments do not affect this filter.
router.get('/sessions', chatController.listSessions);
router.post('/sessions', chatController.createSession);
router.patch('/sessions/:sessionId', chatController.renameSession);
router.delete('/sessions/:sessionId', chatController.deleteSession);

router.get('/session/:docId', chatController.getOrCreateSession);

router.post('/sessions/:sessionId/documents', chatController.attachExistingDocument);
router.post(
  '/sessions/:sessionId/documents/upload',
  upload.single('file'),
  chatController.uploadSessionDocument
);
router.delete('/sessions/:sessionId/documents/recoverable', chatController.permanentlyRemoveAllRecoverableAttachments);
router.delete('/sessions/:sessionId/documents/temporary', chatController.removeTemporaryAttachments);
router.delete('/sessions/:sessionId/documents/:documentId/recoverable', chatController.permanentlyRemoveRecoverableAttachment);
router.delete('/sessions/:sessionId/documents/:documentId', chatController.softDetachDocument);
router.post('/sessions/:sessionId/documents/:documentId/reprocess', chatController.reprocessSessionDocument);
router.post('/sessions/:sessionId/documents/:documentId/restore', chatController.restoreDocument);
router.post('/sessions/:sessionId/documents/:documentId/save-to-library', chatController.saveDocumentToLibrary);

/**
 * @swagger
 * /api/chat/sessions/{sessionId}/messages:
 *   get:
 *     summary: Get all messages in session
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of messages }
 */
router.get('/sessions/:sessionId/messages', chatController.getMessages);

/**
 * @swagger
 * /api/chat/sessions/{sessionId}/messages:
 *   post:
 *     summary: Send question -> get AI answer
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *     responses:
 *       200: { description: AI response }
 */
router.post('/sessions/:sessionId/messages', chatController.sendMessage);

router.post('/sessions/:sessionId/shares/users', chatController.shareSessionWithUser);
router.delete('/sessions/:sessionId/shares/users/:userId', chatController.removeUserShare);
router.post('/sessions/:sessionId/public-link', chatController.createPublicLink);
router.delete('/sessions/:sessionId/public-link', chatController.revokePublicLink);

router.get('/sessions/:sessionId/share-options', snapshotController.getShareOptions);
router.post('/sessions/:sessionId/snapshots', snapshotController.createSnapshot);
router.get('/shared-links', snapshotController.listOwnedLinks);
router.patch('/shared-links/:linkId/access', snapshotController.updateLinkAccess);
router.delete('/shared-links/:linkId', snapshotController.disableLink);
router.post('/shared-snapshots/:token/open', snapshotController.registerRecipientOpen);
router.get('/received-shared-links', snapshotController.listReceivedLinks);
router.delete('/received-shared-links/:recipientId', snapshotController.removeReceivedLink);
router.post('/shared-snapshots/:token/import', snapshotController.importSnapshot);
router.get('/shared-snapshots/:token/documents/:snapshotDocumentId/download', snapshotController.downloadSnapshotDocument);
router.get('/shared-chats', snapshotController.listSharedChats);
router.get('/shared-documents', snapshotController.listSharedDocuments);
router.get('/shared-documents/:documentId/download', snapshotController.downloadSharedDocument);
router.post('/shared-documents/:documentId/save-to-library', snapshotController.saveSharedDocument);

module.exports = router;
