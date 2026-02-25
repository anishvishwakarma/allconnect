const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

function query(text, params) {
  return pool.query(text, params);
}

function row(text, params) {
  return pool.query(text, params).then((r) => r.rows[0] || null);
}

function rows(text, params) {
  return pool.query(text, params).then((r) => r.rows);
}

module.exports = { query, row, rows, pool };
