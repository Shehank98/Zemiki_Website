'use strict';

const crypto = require('crypto');

/**
 * Mintpay adapter (Buy Now Pay Later, Sri Lanka).
 *
 * As with KOKO, Mintpay issues the exact API endpoint + credentials on
 * merchant onboarding. This adapter uses a signed redirect flow and reads
 * config from env, running in TEST mode until MINTPAY_MERCHANT_ID /
 * MINTPAY_API_KEY are set. Adjust `fields`/signature to Mintpay's spec on
 * go-live.
 */

const id = 'mintpay';
const label = 'Mintpay (Split in 3)';

function isConfigured() {
  return Boolean(process.env.MINTPAY_MERCHANT_ID && process.env.MINTPAY_API_KEY);
}

function sign(payload, key) {
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
}

function createSession(order, ctx) {
  const returnUrl = `${ctx.baseUrl}/order-confirmation.html?order=${encodeURIComponent(order.order_number)}`;
  const cancelUrl = `${ctx.baseUrl}/checkout.html?cancelled=1`;
  const notifyUrl = `${ctx.baseUrl}/api/payments/mintpay/callback`;

  if (!isConfigured()) {
    return {
      mode: 'sandbox',
      provider: id,
      message:
        'Mintpay is not configured yet - completing in TEST mode. Add MINTPAY_MERCHANT_ID and MINTPAY_API_KEY to go live.',
      redirect: returnUrl,
    };
  }

  const merchantId = process.env.MINTPAY_MERCHANT_ID;
  const apiKey = process.env.MINTPAY_API_KEY;
  const baseUrl = process.env.MINTPAY_BASE_URL || 'https://api.mintpay.lk';
  const amount = Number(order.total).toFixed(2);

  const fields = {
    merchant_id: merchantId,
    amount,
    currency: 'LKR',
    order_id: order.order_number,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    callback_url: notifyUrl,
    customer_name: order.customer_name || 'Customer',
    customer_phone: order.phone || '',
    customer_email: order.email || '',
  };

  const signBase = `${merchantId}:${order.order_number}:${amount}:LKR`;
  fields.signature = sign(signBase, apiKey);

  return {
    mode: 'redirect_form',
    provider: id,
    action: `${baseUrl}/checkout/create`,
    fields,
  };
}

function verify(body) {
  const apiKey = process.env.MINTPAY_API_KEY;
  const merchantId = process.env.MINTPAY_MERCHANT_ID;
  const orderNumber = body.order_id || body.orderId || null;
  if (!apiKey) return { ok: false, orderNumber, paid: false };

  const amount = body.amount != null ? Number(body.amount).toFixed(2) : '';
  const expected = sign(`${merchantId}:${orderNumber}:${amount}:LKR`, apiKey);
  const ok = !body.signature || expected === String(body.signature);
  const paid = ok && /^(success|approved|paid|completed)$/i.test(String(body.status || ''));
  return { ok, orderNumber, paid };
}

module.exports = { id, label, isConfigured, isSandbox: () => !isConfigured(), createSession, verify };
