const healthService = require('../services/health.service');

async function healthCheck(req, res, next) {
  try {
    res.json({ status: 'ok', app: 'AI Study Hub API' });
  } catch (err) {
    next(err);
  }
}

async function dbCheck(req, res, next) {
  try {
    const result = await healthService.checkDatabase();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { healthCheck, dbCheck };
