'use strict';

/**
 * Stock helpers. Products with variants keep their per-variant stock in
 * product_variants and the product's own `stock` column is the sum of them,
 * so listings, low-stock alerts and "sold out" badges keep working unchanged.
 */

async function syncProductStock(client, productId) {
  await client.query(
    `UPDATE products p
        SET stock = COALESCE((SELECT SUM(stock) FROM product_variants WHERE product_id = p.id), 0)::int
      WHERE p.id = $1
        AND EXISTS (SELECT 1 FROM product_variants WHERE product_id = p.id)`,
    [productId]
  );
}

/**
 * Add (dir = +1) or take (dir = -1) the quantities of order lines.
 * Never lets stock go below zero when taking.
 * @param client pg client inside a transaction
 * @param {{product_id:number, variant_id:number|null, qty:number}[]} lines
 */
async function adjustStock(client, lines, dir) {
  const touched = new Set();
  for (const l of lines) {
    const qty = Math.max(0, parseInt(l.qty, 10) || 0) * dir;
    if (!qty || !l.product_id) continue;
    if (l.variant_id) {
      await client.query(
        'UPDATE product_variants SET stock = GREATEST(0, stock + $1) WHERE id = $2',
        [qty, l.variant_id]
      );
    } else {
      await client.query(
        'UPDATE products SET stock = GREATEST(0, stock + $1) WHERE id = $2',
        [qty, l.product_id]
      );
    }
    touched.add(l.product_id);
  }
  for (const pid of touched) await syncProductStock(client, pid);
}

module.exports = { syncProductStock, adjustStock };
