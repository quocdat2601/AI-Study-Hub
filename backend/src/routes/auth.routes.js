const router = require('express').Router();
const controller = require('../controllers/auth.controller');

router.get('/', controller.placeholder);

module.exports = router;
