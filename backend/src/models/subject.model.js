const pool = require('../config/db');

async function listSubjects() {
  const result = await pool.query('SELECT * FROM subjects ORDER BY name ASC');
  return result.rows;
}

async function createSubject({ name, code, description, createdBy }) {
  const result = await pool.query(
    `INSERT INTO subjects (name, code, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, code, description || null, createdBy]
  );
  return result.rows[0];
}

async function updateSubject(id, { name, code, description }) {
  const result = await pool.query(
    `UPDATE subjects
     SET name = $2, code = $3, description = $4, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, name, code, description || null]
  );
  return result.rows[0] || null;
}

async function countDocuments(id) {
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM documents WHERE subject_id = $1', [id]);
  return result.rows[0].count;
}

async function deleteSubject(id) {
  const result = await pool.query('DELETE FROM subjects WHERE id = $1 RETURNING *', [id]);
  return result.rows[0] || null;
}

module.exports = {
  listSubjects,
  createSubject,
  updateSubject,
  countDocuments,
  deleteSubject,
};
