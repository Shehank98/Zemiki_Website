'use strict';

const crypto = require('crypto');

/**
 * KOKO adapter (Buy Now Pay Later, Sri Lanka).
 *
 * NOTE: KOKO onboards merchants individually and issues the exact IPG
 * endpoint + field spec with your credentials. This adapter is structured
 * as a signed redirect flow (the common KOKO IPG pattern) and reads its
 * config from env. Until KOKO_MERCHANT_ID / KOKO_API_KEY are set it runs in
 * TEST mode. When you receive real credentials + endpoint docs, adjust the
 * `fields`/signature below to match and it goes live with no other changes.
 */

const id = 'koko';
const label = 'KOKO (Pay in 3)';

function isConfigured() {
  return Boolean(process.env.KOKO_MERCHANT_ID && process.env.KOKO_API_KEY);
}

function sign(payload, key) {
  return crypto
    .createHmac('sha256', key)
    .update(payload)
    .digest('hex');
}

function createSession(order, ctx) {
  const returnUrl = `${ctx.baseUrl}/order-confirmation.html?order=${encodeURIComponent(order.order_number)}`;
  const cancelUrl = `${ctx.baseUrl}/checkout.html?cancelled=1`;
  const notifyUrl = `${ctx.baseUrl}/api/payments/koko/callback`;

  if (!isConfigured()) {
    return {
      mode: 'sandbox',
      provider: id,
      message:
        'KOKO is not configured yet - completing in TEST mode. Add KOKO_MERCHANT_ID and KOKO_API_KEY to go live.',
      redirect: returnUrl,
    };
  }

  const merchantId = process.env.KOKO_MERCHANT_ID;
  const apiKey = process.env.KOKO_API_KEY;
  const baseUrl = process.env.KOKO_BASE_URL || 'https://ipg.koko.lk';
  const amount = Number(order.total).toFixed(2);

  const fields = {
    _mId: merchantId,
    amount,
    currency: 'LKR',
    orderId: order.order_number,
    returnUrl,
    cancelUrl,
    responseUrl: notifyUrl,
    customerFirstName: String(order.customer_name || 'Customer').split(' ')[0],
    customerPhone: order.phone || '',
    customerEmail: order.email || '',
  };

  // Signature over the ordered values (adjust to KOKO's exact spec on go-live).
  const signBase = `${merchantId}|${amount}|LKR|${order.order_number}`;
  fields.dataString = signBase;
  fields.signature = sign(signBase, apiKey);

  return {
    mode: 'redirect_form',
    provider: id,
    action: `${baseUrl}/api/v1/checkout`,
    fields,
  };
}

function verify(body) {
  const apiKey = process.env.KOKO_API_KEY;
  const orderNumber = body.orderId || body.order_id || null;
  if (!apiKey) return { ok: false, orderNumber, paid: false };

  // Recompute signature if the callback provides the signed data string.
  if (body.dataString && body.signature) {
    const expected = sign(String(body.dataString), apiKey);
    const ok = expected === String(body.signature);
    const paid = ok && /^(success|approved|paid|2)$/i.test(String(body.status || ''));
    return { ok, orderNumber, paid };
  }
  const paid = /^(success|approved|paid|2)$/i.test(String(body.status || ''));
  return { ok: true, orderNumber, paid };
}

module.exports = { id, label, isConfigured, isSandbox: () => !isConfigured(), createSession, verify };
