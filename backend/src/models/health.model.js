const pool = require('../config/db');

async function getDatabaseTime() {
  const result = await pool.query('SELECT NOW() AS now');
  return result.rows[0].now;
}

module.exports = { getDatabaseTime };
