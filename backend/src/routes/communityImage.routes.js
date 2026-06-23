const router = require('express').Router();
const communityImageController = require('../controllers/communityImage.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const uploadImage = require('../middleware/uploadImage');

router.use(verifyToken, requireRole('user', 'admin'));

router.post('/images', uploadImage.single('image'), communityImageController.uploadImage);

module.exports = router;
