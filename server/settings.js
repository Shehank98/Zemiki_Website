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

/* --------------------------- District shipping -------------------------- */

/**
 * All shipping districts (for the admin editor), ordered.
 */
async function getAllDistricts() {
  try {
    const { rows } = await query(
      'SELECT district, fee, active, sort_order FROM shipping_rates ORDER BY sort_order, district'
    );
    return rows.map((r) => ({
      district: r.district,
      fee: Number(r.fee),
      active: r.active,
      sort_order: r.sort_order,
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Active districts only, for the public checkout dropdown.
 */
async function getDistricts() {
  const all = await getAllDistricts();
  return all.filter((d) => d.active).map((d) => ({ district: d.district, fee: d.fee }));
}

/**
 * Fee for a single district (null if not found / inactive).
 */
async function getDistrictFee(district) {
  if (!district) return null;
  try {
    const { rows } = await query(
      'SELECT fee FROM shipping_rates WHERE district = $1 AND active = true',
      [district]
    );
    return rows.length ? Number(rows[0].fee) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Bulk upsert district rates from the admin editor.
 * @param {Array<{district:string, fee:number, active:boolean}>} rows
 */
async function setDistricts(rows) {
  if (!Array.isArray(rows)) return getAllDistricts();
  for (const r of rows) {
    if (!r || !r.district) continue;
    const fee = Math.max(0, Number(r.fee) || 0);
    const active = r.active === undefined ? true : Boolean(r.active);
    await query(
      `UPDATE shipping_rates SET fee = $2, active = $3 WHERE district = $1`,
      [r.district, fee, active]
    );
  }
  return getAllDistricts();
}

/**
 * Compute shipping for a subtotal + chosen district.
 * Uses the district fee when available, else the flat fallback; the
 * free-shipping-over threshold overrides both.
 */
async function computeShipping(subtotal, district) {
  if (subtotal <= 0) return 0;
  const s = await getSettings();
  if (s.free_shipping_over > 0 && subtotal >= s.free_shipping_over) return 0;
  const districtFee = await getDistrictFee(district);
  return districtFee != null ? districtFee : s.shipping_flat;
}

module.exports = {
  getSettings,
  updateSettings,
  computeShipping,
  getAllDistricts,
  getDistricts,
  getDistrictFee,
  setDistricts,
};
