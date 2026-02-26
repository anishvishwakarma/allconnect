/**
 * Run schema.sql against DATABASE_URL. Use when psql is not available (e.g. Windows).
 * Usage: node scripts/init-db.js   (from backend folder, with .env loaded)
 *
 * Creates: users, otp_codes, posts, join_requests, group_chats, group_chat_members,
 *          messages, post_participations + indexes.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set in .env');
  process.exit(1);
}

const schemaPath = path.join(__dirname, '..', 'schema.sql');
if (!fs.existsSync(schemaPath)) {
  console.error('schema.sql not found at', schemaPath);
  process.exit(1);
}
const sql = fs.readFileSync(schemaPath, 'utf8');

const parsed = new URL(url);
const useSSL = process.env.DATABASE_SSL !== 'false';
const pool = new Pool({
  connectionString: url,
  ssl: useSSL ? { rejectUnauthorized: false, servername: parsed.hostname } : false,
});

console.log('Connecting to database...');
pool.query('SELECT 1')
  .then(() => {
    console.log('Connected. Applying schema...');
    return pool.query(sql);
  })
  .then(() => {
    console.log('Schema applied successfully. All tables and indexes created.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err.message || err.toString());
    if (err.code) console.error('Code:', err.code);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.position) console.error('Position:', err.position);
    process.exit(1);
  })
  .finally(() => pool.end());
