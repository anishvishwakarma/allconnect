/**
 * Run schema.sql against DATABASE_URL. Use when psql is not available (e.g. Windows).
 * Usage: node scripts/init-db.js   (from backend folder, with .env loaded)
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
const sql = fs.readFileSync(schemaPath, 'utf8');

const parsed = new URL(url);

const pool = new Pool({
  connectionString: url,
  ssl: process.env.DATABASE_SSL !== 'false'
    ? { rejectUnauthorized: false, servername: parsed.hostname }
    : false,
});

pool.query(sql)
  .then(() => {
    console.log('Schema applied successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Schema error:', err.message || err.toString());
    if (err.code) console.error('Code:', err.code);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.position) console.error('Position:', err.position);
    console.error('Full error:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
