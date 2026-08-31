'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { migrate } = require('./migrate');
const { listMethods } = require('./payments');
const { getSettings, getPaymentToggles } = require('./settings');

const app = express();

const { securityHeaders, rateLimit } = require('./middleware/security');

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Canonical clean URLs: redirect /page.html -> /page (301).
app.get(/\.html$/, (req, res, next) => {
  if (req.path === '/admin/index.html') return next();
  const clean = req.path.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  const qs = req.url.slice(req.path.length);
  res.redirect(301, (clean || '/') + qs);
});

/* ------------------------- Public config ------------------------ */
// Non-secret settings the storefront needs (store name, WhatsApp, etc.)
app.get('/api/config', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const toggles = await getPaymentToggles();
    // Only surface methods the admin has enabled.
    const methods = listMethods().filter((m) => toggles[m.id]);
    res.json({
      store_name: process.env.STORE_NAME || 'Zemiki',
      whatsapp_number: process.env.WHATSAPP_NUMBER || '',
      currency: 'LKR',
      currency_symbol: 'Rs.',
      shipping_flat: settings.shipping_flat,
      free_shipping_over: settings.free_shipping_over,
      announcement: { text: settings.announcement_text, enabled: settings.announcement_enabled },
      payment_methods: methods,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

/* ----------------------------- Routes --------------------------- */
// Rate limiters for abuse-prone endpoints.
const writeLimiter = rateLimit({ windowMs: 60000, max: 40 });
const loginLimiter = rateLimit({ windowMs: 15 * 60000, max: 10, message: 'Too many login attempts. Try again later.' });

app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', writeLimiter, require('./routes/orders'));
app.use('/api/enquiries', writeLimiter, require('./routes/enquiries'));
app.use('/api/subscribe', writeLimiter, require('./routes/subscribe'));
app.use('/api/shipping', require('./routes/shipping'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin/login', loginLimiter);
app.use('/api/admin', require('./routes/admin'));

/* --------------------------- Static site ------------------------ */
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Friendly /admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html'));
});

// SPA-ish fallback for unknown non-API GET routes -> home page
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
  next();
});

/* --------------------------- Error handler ---------------------- */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await migrate();
  } catch (err) {
    console.error('[startup] Migration failed:', err.message);
    console.error('[startup] Check DATABASE_URL. Server will still start so you can debug.');
  }
  app.listen(PORT, () => {
    console.log(`\n  Zemiki store running on http://localhost:${PORT}`);
    console.log(`  Admin panel:  http://localhost:${PORT}/admin\n`);
  });
}

start();

module.exports = app;
