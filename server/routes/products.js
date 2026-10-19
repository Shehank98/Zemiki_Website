'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

/**
 * Attach an `images` array (ordered) to each product row.
 */
async function attachImages(products) {
  if (products.length === 0) return products;
  const ids = products.map((p) => p.id);
  const { rows } = await query(
    `SELECT product_id, url FROM product_images
      WHERE product_id = ANY($1::int[])
      ORDER BY sort_order, id`,
    [ids]
  );
  const hv = await query(
    'SELECT DISTINCT product_id FROM product_variants WHERE product_id = ANY($1::int[])',
    [ids]
  );
  const variantIds = new Set(hv.rows.map((r) => r.product_id));
  const byProduct = new Map();
  for (const r of rows) {
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, []);
    byProduct.get(r.product_id).push(r.url);
  }
  for (const p of products) {
    p.images = byProduct.get(p.id) || [];
    p.image = p.images[0] || null;
    p.has_variants = variantIds.has(p.id);
  }
  return products;
}

// GET /api/products?category=slug&q=search&featured=1&sort=price_asc&limit=&offset=
router.get('/', async (req, res, next) => {
  try {
    const { category, q, featured, sort } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 60, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const where = ['p.active = true'];
    const params = [];

    if (category) {
      params.push(category);
      where.push(`c.slug = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
    }
    if (featured === '1' || featured === 'true') {
      where.push('p.featured = true');
    }

    let orderBy = 'p.created_at DESC';
    if (sort === 'price_asc') orderBy = 'COALESCE(p.sale_price, p.price) ASC';
    else if (sort === 'price_desc') orderBy = 'COALESCE(p.sale_price, p.price) DESC';
    else if (sort === 'name') orderBy = 'p.name ASC';

    params.push(limit);
    params.push(offset);

    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${where.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    await attachImages(rows);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug - single product detail
router.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.slug = $1 AND p.active = true`,
      [req.params.slug]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await attachImages(rows);

    // Related products from the same category
    const product = rows[0];
    const related = await query(
      `SELECT p.*, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.active = true AND p.id <> $1
          AND p.category_id IS NOT DISTINCT FROM $2
        ORDER BY p.featured DESC, p.created_at DESC
        LIMIT 4`,
      [product.id, product.category_id]
    );
    await attachImages(related.rows);

    // Variants + per-image codes for the product page (listings stay light).
    const [vr, ir] = await Promise.all([
      query(
        `SELECT id, a_value, b_value, sku, stock FROM product_variants
          WHERE product_id = $1 ORDER BY sort_order, id`,
        [product.id]
      ),
      query(
        `SELECT url, code, a_value FROM product_images
          WHERE product_id = $1 ORDER BY sort_order, id`,
        [product.id]
      ),
    ]);
    const image_items = ir.rows.map((r) => ({ url: r.url, code: r.code || '', a_value: r.a_value || '' }));

    res.json({ ...product, variants: vr.rows, image_items, related: related.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
