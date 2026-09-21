require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('[seatflow-backend] Running schema.sql against the configured database...');
  await pool.query(sql);
  console.log('[seatflow-backend] Migration complete.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('[seatflow-backend] Migration failed:', err);
  process.exit(1);
});
