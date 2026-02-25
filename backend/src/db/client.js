import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it in backend/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    const { rows } = await client.query("SELECT extname FROM pg_extension WHERE extname = 'postgis'");
    if (rows.length === 0) {
      console.error('PostGIS extension not found. Run: psql -d yourdb -c "CREATE EXTENSION postgis;"');
      process.exit(1);
    }
  } finally {
    client.release();
  }
  return pool;
}

export { pool };
