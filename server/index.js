'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { migrate } = require('./migrate');
const { listMethods } = require('./payments');
const { getSettings } = require('./settings');

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/* ------------------------- Public config ------------------------ */
// Non-secret settings the storefront needs (store name, WhatsApp, etc.)
app.get('/api/config', async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({
      store_name: process.env.STORE_NAME || 'Zemiki',
      whatsapp_number: process.env.WHATSAPP_NUMBER || '',
      currency: 'LKR',
      currency_symbol: 'Rs.',
      shipping_flat: settings.shipping_flat,
      free_shipping_over: settings.free_shipping_over,
      payment_methods: listMethods(),
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

/* ----------------------------- Routes --------------------------- */
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/enquiries', require('./routes/enquiries'));
app.use('/api/payments', require('./routes/payments'));
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
