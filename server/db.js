'use strict';

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    '[db] DATABASE_URL is not set. Set it in your .env or Railway variables.'
  );
}

// Railway (and most managed Postgres) require SSL. Enable it in production,
// or whenever PGSSL=true is set. `rejectUnauthorized:false` is standard for
// Railway's self-signed chain.
const useSsl =
  process.env.PGSSL === 'true' || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err);
});

/**
 * Run a parameterized query.
 * @param {string} text
 * @param {Array} [params]
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run a set of statements inside a transaction.
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
