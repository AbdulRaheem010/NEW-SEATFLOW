const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured before starting SeatFlow.');
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
