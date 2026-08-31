'use strict';

const crypto = require('crypto');
const { payhereConfig } = require('../settings');

/**
 * PayHere adapter (cards / bank, Sri Lanka).
 *
 * PayHere uses a form-POST redirect + a signed `hash`. This adapter builds
 * the parameters the front-end needs to POST to PayHere's checkout, and
 * verifies the notify (callback) signature.
 *
 * Docs: https://support.payhere.lk/api-&-mobile-sdk/checkout-api
 */

const id = 'payhere';
const label = 'PayHere (Card / Bank)';

function isConfigured() {
  const c = payhereConfig();
  return Boolean(c.merchant_id && c.secret);
}

function isSandbox() {
  return payhereConfig().sandbox || !isConfigured();
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

/**
 * Build a checkout session. Returns instructions for the browser: either a
 * real PayHere form-post payload, or a sandbox instruction to continue.
 *
 * @param {object} order  { order_number, total, customer_name, phone, email, address, city }
 * @param {object} ctx    { baseUrl }
 */
function createSession(order, ctx) {
  const returnUrl = `${ctx.baseUrl}/order-confirmation?order=${encodeURIComponent(order.order_number)}`;
  const cancelUrl = `${ctx.baseUrl}/checkout?cancelled=1`;
  const notifyUrl = `${ctx.baseUrl}/api/payments/payhere/callback`;

  if (!isConfigured()) {
    return {
      mode: 'sandbox',
      provider: id,
      message:
        'PayHere is not configured yet - completing in TEST mode. Add PAYHERE_MERCHANT_ID and PAYHERE_SECRET to go live.',
      redirect: returnUrl,
    };
  }

  const cfg = payhereConfig();
  const merchantId = cfg.merchant_id;
  const secret = cfg.secret;
  const amount = Number(order.total).toFixed(2);
  const currency = 'LKR';

  // hash = MD5(merchant_id + order_id + amount + currency + MD5(secret))
  const hashedSecret = md5(secret);
  const hash = md5(`${merchantId}${order.order_number}${amount}${currency}${hashedSecret}`);

  const [firstName, ...rest] = String(order.customer_name || 'Customer').split(' ');

  const action = isSandbox()
    ? 'https://sandbox.payhere.lk/pay/checkout'
    : 'https://www.payhere.lk/pay/checkout';

  return {
    mode: 'redirect_form',
    provider: id,
    action,
    fields: {
      merchant_id: merchantId,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      order_id: order.order_number,
      items: `Zemiki order ${order.order_number}`,
      currency,
      amount,
      first_name: firstName,
      last_name: rest.join(' '),
      email: order.email || '',
      phone: order.phone || '',
      address: order.address || '',
      city: order.city || '',
      country: 'Sri Lanka',
      hash,
    },
  };
}

/**
 * Verify a PayHere notify callback.
 * @param {object} body form-encoded notify payload
 * @returns {{ ok: boolean, orderNumber: string|null, paid: boolean }}
 */
function verify(body) {
  const secret = payhereConfig().secret;
  if (!secret) return { ok: false, orderNumber: body.order_id || null, paid: false };

  const local = md5(
    `${body.merchant_id}${body.order_id}${body.payhere_amount}${body.payhere_currency}${md5(secret)}`
  );
  const sigOk = local === String(body.md5sig || '').toUpperCase();
  // status_code 2 = success
  const paid = sigOk && String(body.status_code) === '2';
  return { ok: sigOk, orderNumber: body.order_id || null, paid };
}

module.exports = { id, label, isConfigured, isSandbox, createSession, verify };
