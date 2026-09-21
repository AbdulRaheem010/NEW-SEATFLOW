const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('[seatflow-backend] DATABASE_URL is not set. Set it in .env before starting the server.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  options: '-c search_path=seatflow,public',
});

pool.on('error', (err) => {
  console.error('[seatflow-backend] Unexpected Postgres error', err);
});

module.exports = pool;
