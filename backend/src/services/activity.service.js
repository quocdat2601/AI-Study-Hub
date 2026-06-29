const activityModel = require('../models/activity.model');

function log(entry) {
  activityModel.create(entry).catch((err) => {
    console.error('Activity log failed:', err.message);
  });
}

async function listLatest(limit) {
  return activityModel.listLatest(limit);
}

async function listByUserId(userId, limit) {
  return activityModel.listByUserId(userId, limit);
}

async function listByActions(actions, limit) {
  return activityModel.listByActions(actions, limit);
}

module.exports = {
  log,
  listLatest,
  listByUserId,
  listByActions,
};
