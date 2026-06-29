require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Missing DATABASE_URL in backend/.env');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '../db/migrations/006_account_profile.sql');
  const sqlPath007 = path.join(__dirname, '../db/migrations/007_account_avatar.sql');
  const sql = `${fs.readFileSync(sqlPath, 'utf8')}\n${fs.readFileSync(sqlPath007, 'utf8')}`;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log('Account migration completed successfully.');
  } catch (error) {
    console.error('Account migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
