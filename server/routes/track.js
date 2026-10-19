'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// The stages shown to the customer, mapped to the internal order_status values.
const STAGES = [
  { key: 'new', status: 'new', label: 'Order placed', hint: 'We received your order.' },
  { key: 'processing', status: 'processing', label: 'Confirmed', hint: 'Your order is confirmed and being prepared.' },
  { key: 'packed', status: 'packed', label: 'Packed', hint: 'Your items are packed and ready for the courier.' },
  { key: 'shipped', status: 'shipped', label: 'Dispatched', hint: 'Your order is on its way to you.' },
  { key: 'delivered', status: 'delivered', label: 'Delivered', hint: 'Delivered. We hope you love it!' },
];

/**
 * GET /api/track/:token
 * Public, but only reachable with the order's secret token. Returns what a
 * customer needs (progress, items, courier) and deliberately leaves out phone,
 * email, street address and payment internals.
 */
router.get('/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '');
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return res.status(404).json({ error: 'Tracking link not found' });

    const { rows } = await query('SELECT * FROM orders WHERE track_token = $1', [token]);
    if (!rows.length) return res.status(404).json({ error: 'Tracking link not found' });
    const o = rows[0];

    const [items, events] = await Promise.all([
      query('SELECT product_name, variant_label, sku, qty FROM order_items WHERE order_id=$1 ORDER BY id', [o.id]),
      query('SELECT status, created_at FROM order_events WHERE order_id=$1 ORDER BY created_at, id', [o.id]),
    ]);

    // Latest time each status was reached.
    const at = {};
    for (const e of events.rows) at[e.status] = e.created_at;

    const cancelled = o.order_status === 'cancelled';
    // Progress is the furthest stage reached, so a skipped stage still shows done.
    let reached = -1;
    STAGES.forEach((st, i) => { if (at[st.status] || st.status === o.order_status) reached = Math.max(reached, i); });
    if (cancelled) {
      reached = -1;
      STAGES.forEach((st, i) => { if (at[st.status]) reached = Math.max(reached, i); });
    }

    const timeline = STAGES.map((st, i) => ({
      key: st.key,
      label: st.label,
      hint: st.hint,
      at: at[st.status] || null,
      state: i < reached ? 'done' : i === reached ? (cancelled ? 'done' : (st.key === 'delivered' ? 'done' : 'current')) : 'todo',
    }));

    res.set('Cache-Control', 'no-store');
    res.json({
      order_number: o.order_number,
      first_name: String(o.customer_name || '').trim().split(/\s+/)[0] || '',
      placed_at: o.created_at,
      status: o.order_status,
      cancelled,
      cancelled_at: cancelled ? (at.cancelled || null) : null,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      deliver_to: [o.city, o.district].filter(Boolean).join(', '),
      total: Number(o.total),
      tracking_id: o.tracking_id || '',
      courier: o.courier || '',
      courier_url: o.courier_url || '',
      timeline,
      items: items.rows.map((i) => ({
        name: i.product_name, variant: i.variant_label || '', sku: i.sku || '', qty: i.qty,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
