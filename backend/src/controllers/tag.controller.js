const tagModel = require('../models/tag.model');

async function listTags(req, res, next) {
  try {
    const tags = await tagModel.list({ q: req.query.q, limit: req.query.limit });
    res.json(tags);
  } catch (err) {
    next(err);
  }
}

module.exports = { listTags };
