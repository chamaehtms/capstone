const path = require('path');
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  require('dotenv').config();
}

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn(
    '[db] WARNING: DATABASE_URL is not set. Copy .env.example to .env and set your Neon connection string.'
  );
}

// Neon requires SSL. `sslmode=require` in the connection string plus this
// rejectUnauthorized:false works for Neon's pooled connection strings without
// needing to vendor a CA certificate.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 120000,
  connectionTimeoutMillis: 45000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message || err);
});

// Resilient query wrapper: automatically retries on transient connection timeouts / compute wake-up
const originalQuery = pool.query.bind(pool);
pool.query = async function resilientQuery(text, params) {
  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await originalQuery(text, params);
    } catch (err) {
      const msg = err.message || '';
      const isTransient =
        msg.includes('timeout') ||
        msg.includes('Connection terminated') ||
        msg.includes('ECONNRESET') ||
        msg.includes('server closed the connection') ||
        msg.includes('connection ended') ||
        err.code === '57P01' || // compute restart
        err.code === '08006' || // connection failure
        err.code === '08001';   // unable to establish connection

      if (isTransient && attempt <= maxRetries) {
        console.warn(`[db] Transient connection issue on attempt ${attempt} (${msg}). Reconnecting in 1.5s...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      throw err;
    }
  }
};

module.exports = pool;
