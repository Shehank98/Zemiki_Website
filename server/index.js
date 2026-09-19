'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');

const { migrate } = require('./migrate');
const { listMethods } = require('./payments');
const { getSettings, getPaymentToggles } = require('./settings');
const { normalizeImageUrl } = require('./utils/driveImage');

const app = express();

const { securityHeaders, rateLimit } = require('./middleware/security');

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/* --------------------- Cache-busting for assets ------------------ */
// A content hash of every CSS/JS file. It changes whenever any asset
// changes (i.e. on every deploy that ships new front-end code), so the
// browser is forced to fetch the new files instead of serving a stale
// cached copy. This is what stops "I updated the site but it still shows
// the old version" for good, no manual version bumping required.
function computeAssetVersion() {
  try {
    const hash = crypto.createHash('md5');
    const dirs = [path.join(PUBLIC_DIR, 'css'), path.join(PUBLIC_DIR, 'js')];
    for (const dir of dirs) {
      let files = [];
      try { files = fs.readdirSync(dir).sort(); } catch (_) { /* dir may not exist */ }
      for (const f of files) {
        if (!/\.(css|js)$/.test(f)) continue;
        try { hash.update(fs.readFileSync(path.join(dir, f))); } catch (_) { /* ignore */ }
      }
    }
    return hash.digest('hex').slice(0, 10);
  } catch (_) {
    return String(Date.now());
  }
}
const ASSET_VERSION = computeAssetVersion();

// Rewrite an HTML page so every local css/js reference carries ?v=<hash>,
// and expose the version to layout.js (which injects anim.js dynamically).
const htmlCache = new Map();
function renderHtml(filePath) {
  const cached = htmlCache.get(filePath);
  if (cached) return cached;
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/(href|src)="(\/[^"?]+\.(?:css|js))"/g,
    (m, attr, url) => `${attr}="${url}?v=${ASSET_VERSION}"`);
  const inject = `<script>window.__ZV=${JSON.stringify(ASSET_VERSION)};</script>`;
  html = html.includes('</head>') ? html.replace('</head>', inject + '</head>') : inject + html;
  htmlCache.set(filePath, html);
  return html;
}

// Send an HTML file with cache-busted asset links and a no-cache header so
// the document itself is always revalidated (and thus always references the
// current asset version).
function sendHtml(res, filePath) {
  try {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(renderHtml(filePath));
    return true;
  } catch (_) {
    return false;
  }
}

// Canonical clean URLs: redirect /page.html -> /page (301).
app.get(/\.html$/, (req, res, next) => {
  if (req.path === '/admin/index.html') return next();
  const clean = req.path.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  const qs = req.url.slice(req.path.length);
  res.redirect(301, (clean || '/') + qs);
});

// Serve storefront HTML pages through the version rewriter (clean URLs like
// /shop map to public/shop.html). Runs before express.static.
app.get(/^\/(?!api\/|admin(?:\/|$))[^.]*$/, (req, res, next) => {
  let rel = req.path;
  if (rel === '/' ) rel = '/index.html';
  else if (rel.endsWith('/')) rel += 'index.html';
  else rel += '.html';
  const filePath = path.join(PUBLIC_DIR, rel);
  // Guard against path traversal: resolved path must stay inside PUBLIC_DIR.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return next();
  if (!fs.existsSync(filePath)) return next();
  if (sendHtml(res, filePath)) return;
  next();
});

// Admin SPA shell, also through the version rewriter (before express.static,
// which would otherwise serve/redirect it unversioned).
app.get(['/admin', '/admin/', '/admin/index.html'], (req, res, next) => {
  const adminIndex = path.join(PUBLIC_DIR, 'admin', 'index.html');
  if (sendHtml(res, adminIndex)) return;
  next();
});

/* ------------------------- Public config ------------------------ */
// Non-secret settings the storefront needs (store name, WhatsApp, etc.)
app.get('/api/config', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const toggles = await getPaymentToggles();
    // Only surface methods the admin has enabled.
    const methods = listMethods().filter((m) => toggles[m.id]);
    const igImages = String(settings.instagram_images || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [image, link] = line.split('|').map((s) => s.trim());
        return { image: normalizeImageUrl(image), link: link || '' };
      })
      .filter((t) => t.image);
    // Assemble up to two bank-transfer accounts (only those with the essentials filled in).
    const bankAccounts = [1, 2].map((n) => ({
      bank: settings['bank' + n + '_bank'] || '',
      holder: settings['bank' + n + '_holder'] || '',
      account: settings['bank' + n + '_account'] || '',
      branch: settings['bank' + n + '_branch'] || '',
      code: settings['bank' + n + '_code'] || '',
    })).filter((a) => a.bank && a.account);
    const heroImages = String(settings.hero_images || '')
      .split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map(normalizeImageUrl);
    res.json({
      store_name: settings.store_name || process.env.STORE_NAME || 'Zemiki',
      whatsapp_number: settings.whatsapp_number || process.env.WHATSAPP_NUMBER || '',
      logo_url: normalizeImageUrl(settings.logo_url || ''),
      currency: 'LKR',
      currency_symbol: 'Rs.',
      shipping_flat: settings.shipping_flat,
      free_shipping_over: settings.free_shipping_over,
      announcement: { text: settings.announcement_text, enabled: settings.announcement_enabled },
      intl: { enabled: settings.intl_enabled, shipping_flat: settings.intl_shipping_flat },
      social: {
        instagram: settings.instagram_url || '',
        tiktok: settings.tiktok_url || '',
        facebook: settings.facebook_url || '',
      },
      hero: {
        eyebrow: settings.hero_eyebrow || '',
        title: settings.hero_title || '',
        subtitle: settings.hero_subtitle || '',
        image: normalizeImageUrl(settings.hero_image || ''),
        images: heroImages,
        cta_text: settings.hero_cta_text || '',
        cta_link: settings.hero_cta_link || '/shop',
      },
      bank_accounts: bankAccounts,
      about: {
        title: settings.about_title || '',
        body: settings.about_body || '',
        image: normalizeImageUrl(settings.about_image || ''),
      },
      contact: {
        intro: settings.contact_intro || '',
        email: settings.contact_email || '',
        phone: settings.contact_phone || '',
        address: settings.contact_address || '',
      },
      instagram_images: igImages,
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
app.use('/api/testimonials', require('./routes/testimonials'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin/login', loginLimiter);
app.use('/api/admin', require('./routes/admin'));

/* --------------------------- Static site ------------------------ */
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders(res) {
    // Assets (css/js/images) are cache-busted via ?v=<hash> in the HTML, so
    // a URL only changes when its content does. Force revalidation with
    // no-cache to defeat the browser's heuristic caching, which is what
    // leaves stale CSS/JS on screen after a deploy.
    res.set('Cache-Control', 'no-cache');
  },
}));

// SPA-ish fallback for unknown non-API GET routes -> home page
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    if (sendHtml(res, path.join(PUBLIC_DIR, 'index.html'))) return;
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
    await getSettings(); // warm KOKO credential cache so payment status is correct on first request
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
