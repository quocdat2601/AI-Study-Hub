const healthModel = require('../models/health.model');

async function checkDatabase() {
  const now = await healthModel.getDatabaseTime();
  return { status: 'ok', databaseTime: now };
}

module.exports = { checkDatabase };
