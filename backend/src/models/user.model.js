const pool = require('../config/db');

const SAFE_USER_FIELDS = `
  id,
  email,
  role,
  status,
  storage_limit_bytes,
  created_at,
  updated_at,
  last_login_at
`;

async function findByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(`SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function createStudent(email, passwordHash) {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, role, status)
     VALUES ($1, $2, 'student', 'active')
     RETURNING ${SAFE_USER_FIELDS}`,
    [email, passwordHash]
  );
  return result.rows[0];
}

async function updateLastLogin(id) {
  await pool.query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [id]);
}

async function listUsers() {
  const result = await pool.query(`SELECT ${SAFE_USER_FIELDS} FROM users ORDER BY created_at DESC`);
  return result.rows;
}

async function updateStatus(id, status) {
  const result = await pool.query(
    `UPDATE users
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING ${SAFE_USER_FIELDS}`,
    [id, status]
  );
  return result.rows[0] || null;
}

module.exports = {
  findByEmail,
  findById,
  createStudent,
  updateLastLogin,
  listUsers,
  updateStatus,
};
