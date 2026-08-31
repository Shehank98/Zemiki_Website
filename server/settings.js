'use strict';

const { query } = require('./db');

const DEFAULT_ANNOUNCEMENT =
  'Free islandwide delivery on orders over Rs. 15,000 · Pay with KOKO, Mintpay & PayHere';

// Typed settings schema. Each key knows how to coerce and default itself.
const SETTINGS_SCHEMA = {
  shipping_flat: { type: 'number', def: () => Number(process.env.SHIPPING_FLAT_LKR || 350) },
  free_shipping_over: { type: 'number', def: () => Number(process.env.FREE_SHIPPING_OVER_LKR || 0) },
  announcement_text: { type: 'text', def: () => DEFAULT_ANNOUNCEMENT },
  announcement_enabled: { type: 'bool', def: () => true },
  // International orders
  intl_enabled: { type: 'bool', def: () => false },
  intl_shipping_flat: { type: 'number', def: () => Number(process.env.INTL_SHIPPING_LKR || 0) },
  // Social links (shown in the storefront footer)
  instagram_url: { type: 'text', def: () => process.env.INSTAGRAM_URL || '' },
  tiktok_url: { type: 'text', def: () => process.env.TIKTOK_URL || '' },
  facebook_url: { type: 'text', def: () => process.env.FACEBOOK_URL || '' },
  // KOKO payment credentials (settable from the admin panel; env is the fallback)
  koko_merchant_id: { type: 'text', def: () => process.env.KOKO_MERCHANT_ID || '' },
  koko_api_key: { type: 'text', def: () => process.env.KOKO_API_KEY || '' },
};

// In-memory cache of KOKO credentials so the (synchronous) payment adapter can
// read the latest admin-saved values without an async DB call per request.
let _kokoCache = null;
function kokoConfig() {
  const c = _kokoCache || {};
  return {
    merchant_id: c.koko_merchant_id || process.env.KOKO_MERCHANT_ID || '',
    api_key: c.koko_api_key || process.env.KOKO_API_KEY || '',
    base_url: process.env.KOKO_BASE_URL || 'https://ipg.koko.lk',
  };
}

/**
 * Read store settings, merging DB values over defaults, coerced by type.
 */
async function getSettings() {
  const map = {};
  try {
    const { rows } = await query('SELECT key, value FROM settings');
    rows.forEach((r) => { map[r.key] = r.value; });
  } catch (e) { /* fall through to defaults */ }

  const out = {};
  for (const [key, spec] of Object.entries(SETTINGS_SCHEMA)) {
    const raw = map[key];
    if (raw === undefined) { out[key] = spec.def(); continue; }
    if (spec.type === 'number') out[key] = Number(raw);
    else if (spec.type === 'bool') out[key] = raw === 'true';
    else out[key] = raw;
  }
  _kokoCache = { koko_merchant_id: out.koko_merchant_id, koko_api_key: out.koko_api_key };
  return out;
}

/**
 * Persist a subset of settings (only known keys, coerced by type).
 */
async function updateSettings(patch) {
  for (const [key, spec] of Object.entries(SETTINGS_SCHEMA)) {
    if (patch[key] === undefined) continue;
    let value;
    if (spec.type === 'number') value = String(Math.max(0, Number(patch[key]) || 0));
    else if (spec.type === 'bool') value = patch[key] ? 'true' : 'false';
    else value = String(patch[key]).slice(0, 300);
    await query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, value]
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
async function computeShipping(subtotal, district, country) {
  if (subtotal <= 0) return 0;
  const s = await getSettings();
  // International order: flat international fee (free-over is islandwide only).
  if (country && String(country).trim().toLowerCase() !== 'sri lanka') {
    return s.intl_shipping_flat;
  }
  if (s.free_shipping_over > 0 && subtotal >= s.free_shipping_over) return 0;
  const districtFee = await getDistrictFee(district);
  return districtFee != null ? districtFee : s.shipping_flat;
}

/* --------------------------- Payment methods -------------------------- */

// The payment methods the storefront can offer. Admin toggles visibility.
const PAYMENT_IDS = ['koko', 'mintpay', 'payhere', 'cod', 'whatsapp'];

/**
 * Which payment methods are enabled (visible to customers). Defaults to all
 * enabled when nothing has been saved yet.
 * @returns {Promise<Object<string, boolean>>}
 */
async function getPaymentToggles() {
  const map = {};
  try {
    const { rows } = await query("SELECT key, value FROM settings WHERE key LIKE 'pm_%'");
    rows.forEach((r) => { map[r.key] = r.value; });
  } catch (e) { /* fall through to defaults */ }
  const out = {};
  PAYMENT_IDS.forEach((id) => {
    out[id] = map['pm_' + id] !== undefined ? map['pm_' + id] === 'true' : true;
  });
  return out;
}

/**
 * Persist which payment methods are enabled.
 * @param {Object<string, boolean>} obj
 */
async function setPaymentToggles(obj) {
  for (const id of PAYMENT_IDS) {
    if (obj[id] === undefined) continue;
    await query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      ['pm_' + id, obj[id] ? 'true' : 'false']
    );
  }
  return getPaymentToggles();
}

module.exports = {
  getSettings,
  updateSettings,
  computeShipping,
  kokoConfig,
  getAllDistricts,
  getDistricts,
  getDistrictFee,
  setDistricts,
  PAYMENT_IDS,
  getPaymentToggles,
  setPaymentToggles,
};
