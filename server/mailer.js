'use strict';

/**
 * Email delivery via a Google Apps Script web app.
 *
 * The server never sends mail itself; it POSTs a JSON payload to your deployed
 * Apps Script URL (APPSCRIPT_URL), which uses Gmail/MailApp to send. This keeps
 * SMTP credentials out of the app and works on Railway's network policy.
 *
 * Set in the environment:
 *   APPSCRIPT_URL     - the deployed web-app URL (…/exec)
 *   APPSCRIPT_SECRET  - a shared secret echoed back by the script to reject abuse
 *   STORE_NAME, WHATSAPP_NUMBER - used in the email content
 *
 * All calls are best-effort: a mail failure never breaks an order.
 */

function isConfigured() {
  return Boolean(process.env.APPSCRIPT_URL);
}

async function post(payload) {
  if (!isConfigured()) {
    console.warn('[mail] APPSCRIPT_URL not set - skipping email (test mode).');
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(process.env.APPSCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.APPSCRIPT_SECRET || '', ...payload }),
      // Apps Script can be slow to warm up; don't hang forever.
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('[mail] Apps Script responded', res.status, text.slice(0, 200));
      return { ok: false, status: res.status, error: 'Apps Script HTTP ' + res.status };
    }
    // Apps Script always replies 200; the real outcome is in the JSON body.
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { /* not JSON */ }
    if (!parsed) {
      // Usually an HTML login page => the web app isn't shared with "Anyone".
      console.error('[mail] Apps Script returned non-JSON (check deployment access: Anyone).');
      return { ok: false, error: 'Apps Script did not return JSON - redeploy the web app with access set to "Anyone".' };
    }
    if (parsed.ok === false) {
      console.error('[mail] Apps Script rejected:', parsed.error);
      return { ok: false, error: 'Apps Script: ' + (parsed.error || 'rejected') };
    }
    return { ok: true, sent: parsed.sent };
  } catch (err) {
    console.error('[mail] send failed:', err.message);
    return { ok: false, error: err.message };
  }
}

function storeCtx() {
  return {
    store_name: process.env.STORE_NAME || 'Zemiki',
    whatsapp_number: process.env.WHATSAPP_NUMBER || '',
    currency_symbol: 'Rs.',
  };
}

/**
 * Send an order invoice to the customer.
 * @param {object} order  full order row
 * @param {Array}  items  order_items rows
 */
async function sendInvoice(order, items) {
  if (!order || !order.email) return { ok: false, skipped: true };
  return post({
    type: 'invoice',
    store: storeCtx(),
    order: {
      order_number: order.order_number,
      customer_name: order.customer_name,
      email: order.email,
      phone: order.phone,
      address: order.address,
      city: order.city,
      district: order.district,
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping),
      total: Number(order.total),
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      is_gift: order.is_gift,
      created_at: order.created_at,
      items: (items || []).map((i) => ({
        name: i.product_name, qty: i.qty, unit_price: Number(i.unit_price),
      })),
    },
  });
}

/**
 * Send shipping/tracking details for an order to the customer.
 * @param {object} order  full order row (must have email + tracking_id)
 */
async function sendTracking(order) {
  if (!order || !order.email) return { ok: false, skipped: true };
  return post({
    type: 'tracking',
    store: storeCtx(),
    order: {
      order_number: order.order_number,
      customer_name: order.customer_name,
      email: order.email,
      address: order.address,
      city: order.city,
      district: order.district,
      order_status: order.order_status,
      tracking_id: order.tracking_id,
    },
  });
}

/**
 * Broadcast a marketing / new-offer email to a list of recipients.
 * @param {object} opts { subject, heading, body, cta_text, cta_url, image_url }
 * @param {string[]} recipients
 */
async function sendBroadcast(opts, recipients) {
  const list = Array.from(new Set((recipients || []).filter(Boolean)));
  if (!list.length) return { ok: false, skipped: true, reason: 'no recipients' };
  return post({
    type: 'broadcast',
    store: storeCtx(),
    recipients: list,
    message: {
      subject: opts.subject || 'News from Zemiki',
      heading: opts.heading || '',
      body: opts.body || '',
      cta_text: opts.cta_text || 'Shop Now',
      cta_url: opts.cta_url || '',
      image_url: opts.image_url || '',
    },
  });
}

module.exports = { isConfigured, sendInvoice, sendTracking, sendBroadcast };
