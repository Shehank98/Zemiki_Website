'use strict';

const { query } = require('./db');

/**
 * Append a status change to an order's history (the tracking timeline).
 * `db` is a pg client inside a transaction, or omit to use the pool.
 */
async function recordEvent(orderId, status, note, db) {
  const run = db ? db.query.bind(db) : query;
  await run('INSERT INTO order_events (order_id, status, note) VALUES ($1,$2,$3)', [orderId, status, note || null]);
}

module.exports = { recordEvent };
