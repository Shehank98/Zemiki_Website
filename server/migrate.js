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

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const { rows } = await query(
    'SELECT id FROM admin_users WHERE username = $1',
    [username]
  );
  if (rows.length > 0) return;

  const hash = await bcrypt.hash(password, 10);
  await query(
    'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
    [username, hash]
  );
  console.log(`[migrate] Seeded admin user "${username}".`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      '[migrate] WARNING: ADMIN_PASSWORD not set — using default "admin123". Change it!'
    );
  }
}

async function migrate() {
  await query(SCHEMA_SQL);
  await seedCategories();
  await seedAdmin();
  console.log('[migrate] Schema is up to date.');
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
