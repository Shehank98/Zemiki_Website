'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { slugify } = require('../migrate');
const { normalizeImageUrl } = require('../utils/driveImage');
const { getSettings, updateSettings, getAllDistricts, setDistricts, getPaymentToggles, setPaymentToggles } = require('../settings');
const { listMethods } = require('../payments');
const mailer = require('../mailer');
const {
  requireAdmin,
  signToken,
  setAuthCookie,
  clearAuthCookie,
} = require('../middleware/auth');

const router = express.Router();

/* ----------------------------- Auth ----------------------------- */

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const { rows } = await query('SELECT * FROM admin_users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ id: user.id, username: user.username });
    setAuthCookie(res, token);
    res.json({ ok: true, username: user.username });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username });
});

// Everything below requires auth
router.use(requireAdmin);

/* --------------------------- Dashboard -------------------------- */

router.get('/stats', async (req, res, next) => {
  try {
    const [products, orders, revenue, enquiries, recent] = await Promise.all([
      query('SELECT COUNT(*)::int AS c FROM products'),
      query('SELECT COUNT(*)::int AS c FROM orders'),
      query(`SELECT COALESCE(SUM(total),0)::float AS s FROM orders WHERE payment_status = 'paid'`),
      query('SELECT COUNT(*)::int AS c FROM enquiries WHERE handled = false'),
      query(`SELECT order_number, customer_name, total, payment_method, payment_status,
                     order_status, created_at
                FROM orders ORDER BY created_at DESC LIMIT 8`),
    ]);
    res.json({
      products: products.rows[0].c,
      orders: orders.rows[0].c,
      revenue: revenue.rows[0].s,
      open_enquiries: enquiries.rows[0].c,
      recent_orders: recent.rows,
    });
  } catch (err) {
    next(err);
  }
});

// Richer analytics for the dashboard charts.
router.get('/analytics', async (req, res, next) => {
  try {
    const [rev14, statusRows, payRows, topRows, subCount, lowStock, catRows] = await Promise.all([
      query(`SELECT to_char(d.day,'YYYY-MM-DD') AS day,
                     COALESCE(SUM(o.total) FILTER (WHERE o.payment_status='paid'),0)::float AS revenue,
                     COUNT(o.id)::int AS orders
                FROM generate_series((CURRENT_DATE - INTERVAL '13 days'), CURRENT_DATE, INTERVAL '1 day') d(day)
                LEFT JOIN orders o ON o.created_at >= d.day AND o.created_at < d.day + INTERVAL '1 day'
               GROUP BY d.day ORDER BY d.day`),
      query(`SELECT order_status AS k, COUNT(*)::int AS c FROM orders GROUP BY order_status`),
      query(`SELECT payment_method AS k, COUNT(*)::int AS c FROM orders GROUP BY payment_method`),
      query(`SELECT product_name AS k, SUM(qty)::int AS c
                FROM order_items GROUP BY product_name ORDER BY c DESC LIMIT 6`),
      query('SELECT COUNT(*)::int AS c FROM subscribers'),
      query('SELECT COUNT(*)::int AS c FROM products WHERE stock <= 3'),
      query(`SELECT c.name AS k, COUNT(p.id)::int AS c
                FROM categories c LEFT JOIN products p ON p.category_id = c.id
               GROUP BY c.name ORDER BY c DESC LIMIT 6`),
    ]);
    res.json({
      revenue_14d: rev14.rows,
      orders_by_status: statusRows.rows,
      payment_split: payRows.rows,
      top_products: topRows.rows,
      products_by_category: catRows.rows,
      subscribers: subCount.rows[0].c,
      low_stock: lowStock.rows[0].c,
    });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------- Settings -------------------------- */

router.get('/settings', async (req, res, next) => {
  try {
    res.json(await getSettings());
  } catch (err) {
    next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const updated = await updateSettings(req.body || {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// District delivery rates
router.get('/shipping-rates', async (req, res, next) => {
  try {
    res.json(await getAllDistricts());
  } catch (err) {
    next(err);
  }
});

router.put('/shipping-rates', async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : (req.body && req.body.rates) || [];
    res.json(await setDistricts(rows));
  } catch (err) {
    next(err);
  }
});

// Payment method visibility (which methods customers see at checkout)
router.get('/payment-methods', async (req, res, next) => {
  try {
    const toggles = await getPaymentToggles();
    res.json(listMethods().map((m) => ({ ...m, enabled: toggles[m.id] })));
  } catch (err) {
    next(err);
  }
});

router.put('/payment-methods', async (req, res, next) => {
  try {
    res.json(await setPaymentToggles(req.body || {}));
  } catch (err) {
    next(err);
  }
});

/* --------------------------- Categories ------------------------- */

router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*, COUNT(p.id)::int AS product_count
         FROM categories c LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id ORDER BY c.sort_order, c.name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { name, sort_order, image_url } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const { rows } = await query(
      `INSERT INTO categories (name, slug, image_url, sort_order)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, slugify(name), image_url ? normalizeImageUrl(image_url) : null, sort_order || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category already exists' });
    next(err);
  }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    const { name, sort_order, image_url } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const { rows } = await query(
      `UPDATE categories SET name=$1, slug=$2, image_url=$3, sort_order=$4
        WHERE id=$5 RETURNING *`,
      [name, slugify(name), image_url ? normalizeImageUrl(image_url) : null, sort_order || 0, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------- Products -------------------------- */

async function loadProductImages(productId) {
  const { rows } = await query(
    'SELECT url FROM product_images WHERE product_id=$1 ORDER BY sort_order, id',
    [productId]
  );
  return rows.map((r) => r.url);
}

router.get('/products', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name
         FROM products p LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.created_at DESC`
    );
    for (const p of rows) p.images = await loadProductImages(p.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM products WHERE id=$1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    rows[0].images = await loadProductImages(rows[0].id);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

async function uniqueSlug(base, excludeId) {
  let slug = base || 'product';
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await query(
      'SELECT id FROM products WHERE slug=$1 AND ($2::int IS NULL OR id<>$2)',
      [slug, excludeId || null]
    );
    if (rows.length === 0) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

function parsePayload(body) {
  return {
    name: (body.name || '').trim(),
    description: body.description || '',
    price: Number(body.price) || 0,
    sale_price:
      body.sale_price === '' || body.sale_price == null ? null : Number(body.sale_price),
    sku: body.sku || null,
    category_id: body.category_id ? parseInt(body.category_id, 10) : null,
    stock: parseInt(body.stock, 10) || 0,
    featured: Boolean(body.featured),
    active: body.active === undefined ? true : Boolean(body.active),
    images: Array.isArray(body.images)
      ? body.images.map((u) => normalizeImageUrl(u)).filter(Boolean)
      : [],
  };
}

router.post('/products', async (req, res, next) => {
  try {
    const data = parsePayload(req.body || {});
    if (!data.name) return res.status(400).json({ error: 'Name is required' });
    const slug = await uniqueSlug(slugify(data.name), null);

    const created = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products
           (name, slug, description, price, sale_price, sku, category_id, stock, featured, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          data.name, slug, data.description, data.price, data.sale_price,
          data.sku, data.category_id, data.stock, data.featured, data.active,
        ]
      );
      const product = rows[0];
      await insertImages(client, product.id, data.images);
      return product;
    });
    created.images = await loadProductImages(created.id);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put('/products/:id', async (req, res, next) => {
  try {
    const data = parsePayload(req.body || {});
    if (!data.name) return res.status(400).json({ error: 'Name is required' });
    const id = parseInt(req.params.id, 10);
    const slug = await uniqueSlug(slugify(data.name), id);

    const updated = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE products SET
           name=$1, slug=$2, description=$3, price=$4, sale_price=$5, sku=$6,
           category_id=$7, stock=$8, featured=$9, active=$10, updated_at=now()
         WHERE id=$11 RETURNING *`,
        [
          data.name, slug, data.description, data.price, data.sale_price, data.sku,
          data.category_id, data.stock, data.featured, data.active, id,
        ]
      );
      if (rows.length === 0) return null;
      await client.query('DELETE FROM product_images WHERE product_id=$1', [id]);
      await insertImages(client, id, data.images);
      return rows[0];
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    updated.images = await loadProductImages(updated.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

async function insertImages(client, productId, images) {
  for (let i = 0; i < images.length; i++) {
    await client.query(
      'INSERT INTO product_images (product_id, url, sort_order) VALUES ($1,$2,$3)',
      [productId, images[i], i]
    );
  }
}

// Lightweight partial update for inline toggles (featured / active / stock).
router.patch('/products/:id', async (req, res, next) => {
  try {
    const fields = [];
    const params = [];
    const body = req.body || {};
    if (body.featured !== undefined) { params.push(Boolean(body.featured)); fields.push(`featured=$${params.length}`); }
    if (body.active !== undefined) { params.push(Boolean(body.active)); fields.push(`active=$${params.length}`); }
    if (body.stock !== undefined) { params.push(parseInt(body.stock, 10) || 0); fields.push(`stock=$${params.length}`); }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE products SET ${fields.join(', ')}, updated_at=now() WHERE id=$${params.length} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------- Orders --------------------------- */

router.get('/orders', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const items = await query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
    res.json({ ...rows[0], items: items.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/orders/:id', async (req, res, next) => {
  try {
    const { order_status, payment_status } = req.body || {};
    const { rows } = await query(
      `UPDATE orders SET
         order_status = COALESCE($1, order_status),
         payment_status = COALESCE($2, payment_status)
       WHERE id=$3 RETURNING *`,
      [order_status || null, payment_status || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Re-send the invoice email for an order.
router.post('/orders/:id/resend-invoice', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (!rows[0].email) return res.status(400).json({ error: 'This order has no email address' });
    const items = await query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
    const result = await mailer.sendInvoice(rows[0], items.rows);
    if (result.skipped) return res.status(400).json({ error: 'Email is not configured (set APPSCRIPT_URL)' });
    if (!result.ok) return res.status(502).json({ error: 'Mail service did not accept the message' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* --------------------------- Subscribers ------------------------ */

router.get('/subscribers', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, email, created_at FROM subscribers ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.delete('/subscribers/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM subscribers WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Broadcast a new-offer email to subscribers + past customers.
router.post('/broadcast', async (req, res, next) => {
  try {
    const { subject, heading, body, cta_text, cta_url, image_url } = req.body || {};
    if (!subject || !body) return res.status(400).json({ error: 'Subject and body are required' });

    const subs = await query('SELECT email FROM subscribers');
    const custs = await query("SELECT DISTINCT email FROM orders WHERE email IS NOT NULL AND email <> ''");
    const recipients = subs.rows.map((r) => r.email).concat(custs.rows.map((r) => r.email));

    const result = await mailer.sendBroadcast(
      { subject, heading, body, cta_text, cta_url, image_url },
      recipients
    );
    if (result.skipped && result.reason === 'no recipients') {
      return res.status(400).json({ error: 'No subscribers or past customers to email yet' });
    }
    if (result.skipped) return res.status(400).json({ error: 'Email is not configured (set APPSCRIPT_URL)' });
    if (!result.ok) return res.status(502).json({ error: 'Mail service did not accept the message' });
    res.json({ ok: true, recipients: Array.from(new Set(recipients.filter(Boolean))).length });
  } catch (err) {
    next(err);
  }
});

/* --------------------------- Enquiries -------------------------- */

router.get('/enquiries', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.*, p.name AS product_name
         FROM enquiries e LEFT JOIN products p ON p.id = e.product_id
        ORDER BY e.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/enquiries/:id', async (req, res, next) => {
  try {
    const { handled } = req.body || {};
    const { rows } = await query(
      'UPDATE enquiries SET handled=$1 WHERE id=$2 RETURNING *',
      [Boolean(handled), req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
