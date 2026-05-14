const router = require('express').Router();
const controller = require('../controllers/document.controller');

router.get('/', controller.placeholder);

module.exports = router;
