const router = require('express').Router();
const controller = require('../controllers/subject.controller');

router.get('/', controller.placeholder);

module.exports = router;
