const activityModel = require('../models/activity.model');

function log(entry) {
  activityModel.create(entry).catch((err) => {
    console.error('Activity log failed:', err.message);
  });
}

async function listLatest(limit) {
  return activityModel.listLatest(limit);
}

module.exports = {
  log,
  listLatest,
};
