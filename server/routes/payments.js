'use strict';

const express = require('express');
const { query } = require('../db');
const { getProvider, listMethods } = require('../payments');

const router = express.Router();

function baseUrlFor(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${req.get('host')}`;
}

async function findOrder(orderNumber) {
  const { rows } = await query('SELECT * FROM orders WHERE order_number = $1', [orderNumber]);
  return rows[0] || null;
}

async function markPaid(orderNumber, providerRef) {
  await query(
    `UPDATE orders SET payment_status = 'paid', order_status = 'processing', provider_ref = $2
      WHERE order_number = $1`,
    [orderNumber, providerRef || null]
  );
}

// GET /api/payments/methods - available methods + live/test status
router.get('/methods', (req, res) => {
  res.json(listMethods());
});

/**
 * POST /api/payments/:provider/init
 * body: { order_number }
 * Returns the browser instruction to complete payment (redirect form, or
 * a sandbox "just continue" instruction when the provider isn't configured).
 */
router.post('/:provider/init', async (req, res, next) => {
  try {
    const provider = getProvider(req.params.provider);
    if (!provider) return res.status(404).json({ error: 'Unknown payment provider' });

    const order = await findOrder((req.body || {}).order_number);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment_status === 'paid') {
      return res.json({ mode: 'already_paid', provider: provider.id });
    }

    const session = provider.createSession(order, { baseUrl: baseUrlFor(req) });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

/**
 * Sandbox completion - the front-end calls this to finalize a TEST-mode
 * order when the provider has no real credentials yet.
 * POST /api/payments/:provider/sandbox-complete  body: { order_number }
 */
router.post('/:provider/sandbox-complete', async (req, res, next) => {
  try {
    const provider = getProvider(req.params.provider);
    if (!provider) return res.status(404).json({ error: 'Unknown payment provider' });
    if (provider.isConfigured && provider.isConfigured()) {
      return res.status(400).json({ error: 'Provider is live; use the real flow' });
    }
    const order = await findOrder((req.body || {}).order_number);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // In test mode we leave payment_status pending but note the intended method.
    await query(
      `UPDATE orders SET order_status = 'processing', provider_ref = $2 WHERE order_number = $1`,
      [order.order_number, `TEST-${provider.id}`]
    );
    res.json({ ok: true, test_mode: true, order_number: order.order_number });
  } catch (err) {
    next(err);
  }
});

/**
 * Provider callbacks / notify URLs. Accept both GET (return redirect) and
 * POST (server-to-server notify).
 */
async function handleCallback(req, res, next) {
  try {
    const provider = getProvider(req.params.provider);
    if (!provider) return res.status(404).json({ error: 'Unknown payment provider' });

    const payload = { ...req.query, ...req.body };
    const result = provider.verify(payload);

    if (result.ok && result.paid && result.orderNumber) {
      await markPaid(result.orderNumber, payload.payment_id || payload.transactionId || null);
    }

    // POST notifications just need a 200; GET returns redirect to confirmation.
    if (req.method === 'GET' && result.orderNumber) {
      return res.redirect(`/order-confirmation?order=${encodeURIComponent(result.orderNumber)}`);
    }
    res.json({ ok: result.ok, paid: result.paid });
  } catch (err) {
    next(err);
  }
}

router.post('/:provider/callback', handleCallback);
router.get('/:provider/callback', handleCallback);

module.exports = router;
