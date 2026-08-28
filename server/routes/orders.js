'use strict';

const express = require('express');
const { query, withTransaction } = require('../db');

const router = express.Router();

function genOrderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ZM${ymd}-${rand}`;
}

function computeShipping(subtotal) {
  const flat = Number(process.env.SHIPPING_FLAT_LKR || 350);
  const freeOver = Number(process.env.FREE_SHIPPING_OVER_LKR || 0);
  if (freeOver > 0 && subtotal >= freeOver) return 0;
  return flat;
}

const VALID_METHODS = ['koko', 'mintpay', 'payhere', 'cod', 'whatsapp'];

/**
 * POST /api/orders
 * body: { customer:{name,phone,email,address,city,notes}, items:[{id,qty}], payment_method }
 * Prices are re-fetched server-side from the DB (never trust client totals).
 */
router.post('/', async (req, res, next) => {
  try {
    const { customer = {}, items = [], payment_method = 'cod' } = req.body || {};

    if (!customer.name || !customer.phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    const method = VALID_METHODS.includes(payment_method) ? payment_method : 'cod';

    const ids = items.map((i) => parseInt(i.id, 10)).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Invalid items' });
    }

    const { rows: dbProducts } = await query(
      `SELECT id, name, price, sale_price, active FROM products WHERE id = ANY($1::int[])`,
      [ids]
    );
    const byId = new Map(dbProducts.map((p) => [p.id, p]));

    const lineItems = [];
    let subtotal = 0;
    for (const item of items) {
      const p = byId.get(parseInt(item.id, 10));
      if (!p || !p.active) continue;
      const qty = Math.max(1, parseInt(item.qty, 10) || 1);
      const unit = Number(p.sale_price != null ? p.sale_price : p.price);
      subtotal += unit * qty;
      lineItems.push({ product_id: p.id, product_name: p.name, unit_price: unit, qty });
    }
    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'No valid items in cart' });
    }

    const shipping = computeShipping(subtotal);
    const total = subtotal + shipping;
    const orderNumber = genOrderNumber();

    const order = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO orders
           (order_number, customer_name, phone, email, address, city, notes,
            subtotal, shipping, total, payment_method, payment_status, order_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'new')
         RETURNING *`,
        [
          orderNumber,
          customer.name,
          customer.phone,
          customer.email || null,
          customer.address || null,
          customer.city || null,
          customer.notes || null,
          subtotal,
          shipping,
          total,
          method,
          method === 'cod' || method === 'whatsapp' ? 'pending' : 'pending',
        ]
      );
      const created = rows[0];
      for (const li of lineItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price, qty)
           VALUES ($1,$2,$3,$4,$5)`,
          [created.id, li.product_id, li.product_name, li.unit_price, li.qty]
        );
      }
      return created;
    });

    res.status(201).json({
      order_number: order.order_number,
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping),
      total: Number(order.total),
      payment_method: order.payment_method,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
