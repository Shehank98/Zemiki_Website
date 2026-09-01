'use strict';

/**
 * Idempotent schema creation + seeding. Safe to run on every boot.
 * Creates all tables with `IF NOT EXISTS`, seeds default categories when
 * the table is empty, and seeds a single admin user from env vars.
 */

const bcrypt = require('bcryptjs');
const { pool, query } = require('./db');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  image_url   TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT DEFAULT '',
  price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price   NUMERIC(12,2),
  sku          TEXT,
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  stock        INTEGER NOT NULL DEFAULT 0,
  featured     BOOLEAN NOT NULL DEFAULT false,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_images (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  order_number   TEXT NOT NULL UNIQUE,
  customer_name  TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT,
  address        TEXT,
  city           TEXT,
  notes          TEXT,
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  order_status   TEXT NOT NULL DEFAULT 'new',
  provider_ref   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER,
  product_name TEXT NOT NULL,
  unit_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  qty          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS enquiries (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  message     TEXT NOT NULL,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  handled     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS shipping_rates (
  district    TEXT PRIMARY KEY,
  fee         NUMERIC(12,2) NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscribers (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS testimonials (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  location    TEXT,
  rating      INTEGER NOT NULL DEFAULT 5,
  quote       TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_gift BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_message TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS birthday TEXT;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`;

const DEFAULT_CATEGORIES = [
  'Necklaces',
  'Earrings',
  'Bangles',
  'Rings',
  'Bridal Sets',
  'Pendants',
  'Anklets',
];

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function seedCategories() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM categories');
  if (rows[0].count > 0) return;

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const name = DEFAULT_CATEGORIES[i];
    await query(
      `INSERT INTO categories (name, slug, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO NOTHING`,
      [name, slugify(name), i]
    );
  }
  console.log('[migrate] Seeded default categories.');
}

// A small starter catalog so a fresh store isn't empty. Some items include a
// sale_price to demonstrate discounts. Images are royalty-free Unsplash URLs;
// replace them (and these products) from the admin panel any time.
const SAMPLE_PRODUCTS = [
  { name: 'Golden Peacock Necklace', category: 'necklaces', price: 8500, sale_price: 6900, featured: true, stock: 8,
    description: 'A statement peacock-motif necklace with intricate gold detailing.',
    images: ['https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=1000&q=80'] },
  { name: 'Kundan Bridal Necklace Set', category: 'bridal-sets', price: 24500, sale_price: 19999, featured: true, stock: 4,
    description: 'Complete bridal set with matching earrings - timeless Kundan craftsmanship.',
    images: ['https://images.unsplash.com/photo-1602752250015-52934bc45613?auto=format&fit=crop&w=1000&q=80'] },
  { name: 'Rose Gold Jhumka Earrings', category: 'earrings', price: 4500, sale_price: 3999, featured: false, stock: 15,
    description: 'Classic jhumka silhouette in a warm rose-gold finish.',
    images: ['https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=1000&q=80'] },
  { name: 'Temple Design Bangles (Pair)', category: 'bangles', price: 6800, sale_price: null, featured: true, stock: 10,
    description: 'Traditional temple-design bangles, sold as a matched pair.',
    images: ['https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1000&q=80'] },
  { name: 'Emerald Solitaire Ring', category: 'rings', price: 12500, sale_price: 9900, featured: false, stock: 6,
    description: 'A single emerald-green stone set in a delicate gold band.',
    images: ['https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1000&q=80'] },
  { name: 'Pearl Drop Pendant', category: 'pendants', price: 3200, sale_price: null, featured: false, stock: 20,
    description: 'An elegant freshwater-pearl drop on a fine chain.',
    images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80'] },
  { name: 'Antique Gold Anklets', category: 'anklets', price: 5400, sale_price: 4600, featured: false, stock: 12,
    description: 'Antique-finish anklets with tiny ghungroo bells.',
    images: ['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1000&q=80'] },
  { name: 'Ruby Stud Earrings', category: 'earrings', price: 2800, sale_price: null, featured: true, stock: 25,
    description: 'Dainty ruby-red studs for everyday elegance.',
    images: ['https://images.unsplash.com/photo-1596944924616-7b38e7cfac36?auto=format&fit=crop&w=1000&q=80'] },
];

// Runs once (guarded by a settings marker) and only when the catalog is empty,
// so it never overwrites a store that already has products.
async function seedSampleProducts() {
  const marker = await query("SELECT value FROM settings WHERE key = 'sample_seeded'");
  if (marker.rows.length > 0) return;

  const { rows: count } = await query('SELECT COUNT(*)::int AS c FROM products');
  if (count[0].c === 0) {
    const { rows: cats } = await query('SELECT id, slug FROM categories');
    const catBySlug = {};
    cats.forEach((c) => { catBySlug[c.slug] = c.id; });

    for (const p of SAMPLE_PRODUCTS) {
      const { rows } = await query(
        `INSERT INTO products
           (name, slug, description, price, sale_price, category_id, stock, featured, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [p.name, slugify(p.name), p.description, p.price, p.sale_price,
         catBySlug[p.category] || null, p.stock, p.featured]
      );
      if (rows[0]) {
        for (let i = 0; i < p.images.length; i++) {
          await query(
            'INSERT INTO product_images (product_id, url, sort_order) VALUES ($1,$2,$3)',
            [rows[0].id, p.images[i], i]
          );
        }
      }
    }
    console.log(`[migrate] Seeded ${SAMPLE_PRODUCTS.length} sample products.`);
  }

  await query(
    "INSERT INTO settings (key, value) VALUES ('sample_seeded','true') ON CONFLICT (key) DO UPDATE SET value = 'true'"
  );
}

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordExplicit = Boolean(process.env.ADMIN_PASSWORD);

  const { rows } = await query(
    'SELECT id, password_hash FROM admin_users WHERE username = $1',
    [username]
  );

  // New install - create the admin user.
  if (rows.length === 0) {
    const hash = await bcrypt.hash(password, 10);
    await query(
      'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
      [username, hash]
    );
    console.log(`[migrate] Seeded admin user "${username}".`);
    if (!passwordExplicit) {
      console.warn(
        '[migrate] WARNING: ADMIN_PASSWORD not set - using default "admin123". Change it!'
      );
    }
    return;
  }

  // Admin already exists. Keep the password in sync with ADMIN_PASSWORD so the
  // deployment's env var is the single source of truth - changing it and
  // redeploying updates the login. Only rehash/write when it actually differs
  // (keeps boot idempotent).
  if (passwordExplicit) {
    const matches = await bcrypt.compare(password, rows[0].password_hash);
    if (!matches) {
      const hash = await bcrypt.hash(password, 10);
      await query('UPDATE admin_users SET password_hash = $1 WHERE username = $2', [
        hash,
        username,
      ]);
      console.log('[migrate] Updated admin password from ADMIN_PASSWORD.');
    }
  }
}

// Seed shipping defaults into settings (from env) only if not present, so the
// admin panel has initial values to edit.
async function seedShippingDefaults() {
  const defaults = {
    shipping_flat: process.env.SHIPPING_FLAT_LKR || '350',
    free_shipping_over: process.env.FREE_SHIPPING_OVER_LKR || '0',
    announcement_text:
      'Free islandwide delivery on orders over Rs. 15,000 · Pay with KOKO, Mintpay & PayHere',
    announcement_enabled: 'true',
  };
  for (const [key, value] of Object.entries(defaults)) {
    await query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, String(value)]
    );
  }
}

// Sri Lanka's 25 administrative districts with sensible default delivery fees.
// Western province (closer / higher volume) is cheaper by default; admins edit
// every value in Admin -> Settings. Fees are in LKR.
const SRI_LANKA_DISTRICTS = [
  ['Colombo', 350], ['Gampaha', 350], ['Kalutara', 400],
  ['Kandy', 450], ['Matale', 500], ['Nuwara Eliya', 550],
  ['Galle', 450], ['Matara', 500], ['Hambantota', 550],
  ['Jaffna', 650], ['Kilinochchi', 650], ['Mannar', 650],
  ['Vavuniya', 600], ['Mullaitivu', 650], ['Batticaloa', 600],
  ['Ampara', 600], ['Trincomalee', 600], ['Kurunegala', 450],
  ['Puttalam', 500], ['Anuradhapura', 550], ['Polonnaruwa', 550],
  ['Badulla', 550], ['Monaragala', 600], ['Ratnapura', 450],
  ['Kegalle', 450],
];

// Seed district shipping rates once (guarded by a settings marker), so future
// deploys never overwrite fees the admin has customised.
async function seedShippingRates() {
  const marker = await query("SELECT value FROM settings WHERE key = 'districts_seeded'");
  if (marker.rows.length > 0) return;

  for (let i = 0; i < SRI_LANKA_DISTRICTS.length; i++) {
    const [district, fee] = SRI_LANKA_DISTRICTS[i];
    await query(
      `INSERT INTO shipping_rates (district, fee, active, sort_order)
       VALUES ($1, $2, true, $3)
       ON CONFLICT (district) DO NOTHING`,
      [district, fee, i]
    );
  }
  await query(
    "INSERT INTO settings (key, value) VALUES ('districts_seeded','true') ON CONFLICT (key) DO UPDATE SET value = 'true'"
  );
  console.log(`[migrate] Seeded ${SRI_LANKA_DISTRICTS.length} district shipping rates.`);
}

async function migrate() {
  await query(SCHEMA_SQL);
  await seedCategories();
  await seedShippingDefaults();
  await seedShippingRates();
  await seedSampleProducts();
  await seedAdmin();
  await seedTestimonials();
  console.log('[migrate] Schema is up to date.');
}

// Seed a few starter testimonials once (guarded by a settings marker), so the
// home page has social proof out of the box; admin can edit/replace them.
async function seedTestimonials() {
  try {
    const marker = await query("SELECT value FROM settings WHERE key = 'testimonials_seeded'");
    if (marker.rows.length) return;
    const seed = [
      ['Dilani P.', 'Colombo', 5, 'The necklace is even more beautiful in person. Delivery was quick and the packaging felt so premium. I keep getting compliments!'],
      ['Nethmi R.', 'Kandy', 5, "Bought a bridal set for my sister's wedding. Stunning craftsmanship and paying with KOKO made it so easy. Highly recommend Zemiki."],
      ['Ayesha F.', 'Galle', 5, 'Great quality for the price and lovely customer service on WhatsApp. My earrings arrived next day. Will definitely shop again.'],
    ];
    for (let i = 0; i < seed.length; i++) {
      const [name, location, rating, quote] = seed[i];
      await query(
        'INSERT INTO testimonials (name, location, rating, quote, active, sort_order) VALUES ($1,$2,$3,$4,true,$5)',
        [name, location, rating, quote, i]
      );
    }
    await query(
      "INSERT INTO settings (key, value) VALUES ('testimonials_seeded','true') ON CONFLICT (key) DO UPDATE SET value = 'true'"
    );
    console.log('[migrate] Seeded starter testimonials.');
  } catch (e) {
    /* non-fatal */
  }
}

module.exports = { migrate, slugify };

// Allow running directly: `npm run migrate`
if (require.main === module) {
  require('dotenv').config();
  migrate()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] Failed:', err);
      process.exit(1);
    });
}
