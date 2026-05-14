const router = require('express').Router();
const healthController = require('../controllers/health.controller');

router.get('/', healthController.healthCheck);
router.get('/db', healthController.dbCheck);

module.exports = router;
