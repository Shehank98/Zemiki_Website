'use strict';

const express = require('express');
const { query, withTransaction } = require('../db');
const { computeShipping, getPaymentToggles, getSettings } = require('../settings');
const mailer = require('../mailer');
const { adjustStock } = require('../stock');
const { recordEvent } = require('../orderEvents');
const { trackUrl } = require('../utils/siteUrl');
const crypto = require('crypto');

const router = express.Router();

function genOrderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ZM${ymd}-${rand}`;
}

const VALID_METHODS = ['koko', 'bank', 'cod', 'whatsapp'];

/**
 * POST /api/orders
 * body: { customer:{name,phone,email,address,city,notes}, items:[{id,qty,variant_id?}], payment_method }
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

    // Reject a method the admin has disabled.
    const toggles = await getPaymentToggles();
    if (!toggles[method]) {
      return res.status(400).json({ error: 'That payment method is not available' });
    }

    // Country: default Sri Lanka. Block international orders unless enabled.
    const country = (customer.country || 'Sri Lanka').trim();
    const isIntl = country.toLowerCase() !== 'sri lanka';
    if (isIntl) {
      const s = await getSettings();
      if (!s.intl_enabled) {
        return res.status(400).json({ error: 'International orders are not available at the moment' });
      }
    }

    const ids = items.map((i) => parseInt(i.id, 10)).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Invalid items' });
    }

    const { rows: dbProducts } = await query(
      `SELECT id, name, price, sale_price, active, option_a_name, option_b_name
         FROM products WHERE id = ANY($1::int[])`,
      [ids]
    );
    const byId = new Map(dbProducts.map((p) => [p.id, p]));
    const { rows: dbVariants } = await query(
      `SELECT id, product_id, a_value, b_value, sku FROM product_variants
        WHERE product_id = ANY($1::int[])`,
      [ids]
    );
    const variantsById = new Map(dbVariants.map((v) => [v.id, v]));
    const productHasVariants = new Set(dbVariants.map((v) => v.product_id));

    // Build order lines. Same product+variant on two lines is merged so the
    // stock check below sees the real total.
    const merged = new Map();
    for (const item of items) {
      const p = byId.get(parseInt(item.id, 10));
      if (!p || !p.active) continue;
      const qty = Math.max(1, parseInt(item.qty, 10) || 1);
      let variant = null;
      if (productHasVariants.has(p.id)) {
        variant = variantsById.get(parseInt(item.variant_id, 10));
        if (!variant || variant.product_id !== p.id) {
          return res.status(400).json({ error: `Please choose options for ${p.name}` });
        }
      }
      const key = p.id + ':' + (variant ? variant.id : 0);
      if (merged.has(key)) { merged.get(key).qty += qty; continue; }
      const label = variant
        ? [variant.a_value, variant.b_value].filter(Boolean).join(' / ')
        : null;
      merged.set(key, {
        product_id: p.id,
        product_name: p.name,
        unit_price: Number(p.sale_price != null ? p.sale_price : p.price),
        qty,
        variant_id: variant ? variant.id : null,
        variant_label: label,
        sku: variant ? variant.sku : null,
      });
    }
    const lineItems = [...merged.values()];
    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'No valid items in cart' });
    }
    const subtotal = lineItems.reduce((n, li) => n + li.unit_price * li.qty, 0);

    const shipping = await computeShipping(subtotal, customer.district, country);
    const total = subtotal + shipping;
    const orderNumber = genOrderNumber();
    const token = crypto.randomBytes(18).toString('base64url'); // secret tracking link id

    const isGift = Boolean(customer.is_gift);
    const giftMessage = isGift ? (customer.gift_message || '').slice(0, 500) : null;
    const birthday = customer.birthday ? String(customer.birthday).slice(0, 20) : null;

    const { order, savedItems } = await withTransaction(async (client) => {
      // Take the stock first, atomically: lock each row, refuse if short.
      // Locking in a stable order avoids deadlocks between concurrent orders.
      const sorted = [...lineItems].sort((a, b) => (a.variant_id || 0) - (b.variant_id || 0) || a.product_id - b.product_id);
      for (const li of sorted) {
        const r = li.variant_id
          ? await client.query('SELECT stock FROM product_variants WHERE id=$1 FOR UPDATE', [li.variant_id])
          : await client.query('SELECT stock FROM products WHERE id=$1 FOR UPDATE', [li.product_id]);
        const have = r.rows.length ? r.rows[0].stock : 0;
        if (have < li.qty) {
          const what = li.product_name + (li.variant_label ? ` (${li.variant_label})` : '');
          const err = new Error(have > 0 ? `Only ${have} left of ${what}` : `${what} is sold out`);
          err.status = 409;
          throw err;
        }
      }
      await adjustStock(client, sorted, -1);

      const { rows } = await client.query(
        `INSERT INTO orders
           (order_number, customer_name, phone, email, address, city, district, country, notes,
            subtotal, shipping, total, payment_method, payment_status, order_status,
            is_gift, gift_message, birthday, stock_deducted, track_token)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending','new',$14,$15,$16,true,$17)
         RETURNING *`,
        [
          orderNumber,
          customer.name,
          customer.phone,
          customer.email || null,
          customer.address || null,
          customer.city || null,
          isIntl ? null : (customer.district || null),
          country,
          customer.notes || null,
          subtotal,
          shipping,
          total,
          method,
          isGift,
          giftMessage,
          birthday,
          token,
        ]
      );
      const created = rows[0];
      await recordEvent(created.id, 'new', null, client);
      const saved = [];
      for (const li of lineItems) {
        await client.query(
          `INSERT INTO order_items
             (order_id, product_id, product_name, unit_price, qty, variant_id, variant_label, sku)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [created.id, li.product_id, li.product_name, li.unit_price, li.qty,
           li.variant_id, li.variant_label, li.sku]
        );
        saved.push(li);
      }
      return { order: created, savedItems: saved };
    });

    // Best-effort: add the customer's email to the newsletter list (never blocks the order).
    if (customer.email) {
      const em = String(customer.email).trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        query('INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [em]).catch(() => {});
      }
    }

    // Best-effort: email the customer their invoice (never blocks the order).
    mailer.sendInvoice(order, savedItems, { trackUrl: trackUrl(req, order.track_token) }).catch(() => {});

    res.status(201).json({
      order_number: order.order_number,
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping),
      total: Number(order.total),
      payment_method: order.payment_method,
      track_token: order.track_token,
      track_url: trackUrl(req, order.track_token),
    });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
