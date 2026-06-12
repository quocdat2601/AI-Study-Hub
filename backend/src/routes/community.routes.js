const router = require('express').Router();
const communityController = require('../controllers/community.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

router.use(verifyToken, requireRole('user', 'admin'));

router.post('/posts', communityController.createPost);
router.patch('/posts/:id', communityController.updatePost);
router.delete('/posts/:id', communityController.deletePost);
router.post('/posts/:id/replies', communityController.addReply);
router.delete('/replies/:id', communityController.deleteReply);
router.post('/posts/:id/vote', communityController.votePost);
router.post('/replies/:id/vote', communityController.voteReply);
router.post('/posts/:id/accept/:replyId', communityController.acceptReply);
router.post('/posts/:id/report', communityController.reportPost);

module.exports = router;
