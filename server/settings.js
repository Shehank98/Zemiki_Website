'use strict';

const { query } = require('./db');

// Env-based fallbacks used when a setting hasn't been stored in the DB yet.
function defaults() {
  return {
    shipping_flat: Number(process.env.SHIPPING_FLAT_LKR || 350),
    free_shipping_over: Number(process.env.FREE_SHIPPING_OVER_LKR || 0),
  };
}

/**
 * Read store settings, merging DB values over env defaults.
 * @returns {Promise<{shipping_flat:number, free_shipping_over:number}>}
 */
async function getSettings() {
  const d = defaults();
  try {
    const { rows } = await query(
      "SELECT key, value FROM settings WHERE key IN ('shipping_flat','free_shipping_over')"
    );
    const map = {};
    rows.forEach((r) => { map[r.key] = r.value; });
    return {
      shipping_flat: map.shipping_flat != null ? Number(map.shipping_flat) : d.shipping_flat,
      free_shipping_over: map.free_shipping_over != null ? Number(map.free_shipping_over) : d.free_shipping_over,
    };
  } catch (e) {
    return d;
  }
}

/**
 * Compute shipping for a given subtotal using current settings.
 */
async function computeShipping(subtotal) {
  const s = await getSettings();
  if (subtotal <= 0) return 0;
  if (s.free_shipping_over > 0 && subtotal >= s.free_shipping_over) return 0;
  return s.shipping_flat;
}

/**
 * Persist a subset of settings (only known numeric keys).
 * @param {object} patch
 */
async function updateSettings(patch) {
  const allowed = ['shipping_flat', 'free_shipping_over'];
  for (const key of allowed) {
    if (patch[key] === undefined) continue;
    const num = Math.max(0, Number(patch[key]) || 0);
    await query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, String(num)]
    );
  }
  return getSettings();
}

module.exports = { getSettings, computeShipping, updateSettings };
