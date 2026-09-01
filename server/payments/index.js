'use strict';

const koko = require('./koko');
const mintpay = require('./mintpay');
const payhere = require('./payhere');

/**
 * Online payment providers keyed by id. COD and WhatsApp are handled
 * separately (they skip the payment step entirely).
 */
const providers = { koko, mintpay, payhere };

function getProvider(idOrName) {
  return providers[String(idOrName || '').toLowerCase()] || null;
}

/**
 * Public-facing list of payment methods for the storefront, including
 * whether each online provider is live or running in test mode.
 */
function listMethods() {
  const online = Object.values(providers).map((p) => ({
    id: p.id,
    label: p.label,
    kind: 'online',
    configured: p.isConfigured(),
    sandbox: p.isConfigured() ? false : true,
  }));

  return [
    ...online,
    { id: 'bank', label: 'Bank Transfer', kind: 'offline', configured: true, sandbox: false },
    { id: 'cod', label: 'Cash on Delivery', kind: 'offline', configured: true, sandbox: false },
    { id: 'whatsapp', label: 'Order via WhatsApp', kind: 'offline', configured: true, sandbox: false },
  ];
}

module.exports = { providers, getProvider, listMethods };
