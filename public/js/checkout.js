/* Checkout - customer form, payment method, order placement + payment flow */
(function () {
  'use strict';

  const root = document.getElementById('checkoutRoot');
  let districts = []; // [{district, fee}]

  function feeForDistrict(name) {
    const d = districts.find((x) => x.district === name);
    return d ? Number(d.fee) : null;
  }

  function shippingFor(subtotal, cfg, district) {
    const free = Number(cfg.free_shipping_over || 0);
    if (subtotal <= 0) return 0;
    if (free > 0 && subtotal >= free) return 0;
    const fee = feeForDistrict(district);
    return fee != null ? fee : Number(cfg.shipping_flat || 350);
  }

  function methodMeta(m) {
    const map = {
      koko: { desc: 'Split into 3 interest-free installments' },
      mintpay: { desc: 'Pay in 3 with Mintpay' },
      payhere: { desc: 'Visa / Mastercard / Amex / Bank' },
      cod: { desc: 'Pay in cash when your order arrives' },
      whatsapp: { desc: 'Confirm and pay via WhatsApp chat' },
    };
    return map[m.id] || { desc: '' };
  }

  function render(cfg) {
    const items = Cart.items();
    if (!items.length) {
      root.innerHTML = '<div class="empty-state"><h3>Your bag is empty</h3><a class="btn btn-primary" href="/shop.html">Shop now</a></div>';
      return;
    }

    const subtotal = Cart.subtotal();
    const freeOver = Number(cfg.free_shipping_over || 0);
    const isFreeEligible = freeOver > 0 && subtotal >= freeOver;
    const shipping = shippingFor(subtotal, cfg, '');
    const total = subtotal + shipping;
    const methods = (cfg.payment_methods || []).filter((m) => m.kind === 'online' || m.id === 'cod' || m.id === 'whatsapp');

    const districtOptions = ['<option value="">Select your district</option>']
      .concat(districts.map((d) => `<option value="${Z.escapeHtml(d.district)}">${Z.escapeHtml(d.district)}</option>`))
      .join('');

    const summaryLines = items.map((i) =>
      `<div class="summary-row"><span>${Z.escapeHtml(i.name)} × ${i.qty}</span><span>${Z.money(i.price * i.qty)}</span></div>`
    ).join('');

    const payHtml = methods.map((m, idx) => {
      const meta = methodMeta(m);
      const test = m.kind === 'online' && m.sandbox ? '<span class="test-badge">TEST MODE</span>' : '';
      return `
        <label class="pay-method ${idx === 0 ? 'selected' : ''}">
          <input type="radio" name="pay" value="${m.id}" ${idx === 0 ? 'checked' : ''}>
          <div class="pm-body"><strong>${Z.escapeHtml(m.label)}</strong><small>${meta.desc}</small></div>
          ${test}
        </label>`;
    }).join('');

    root.innerHTML = `
      <div class="cart-layout">
        <form id="checkoutForm">
          <div class="summary" style="position:static;margin-bottom:24px">
            <h3>Delivery Details</h3>
            <div class="form-row">
              <div class="field"><label>Full Name *</label><input name="name" required></div>
              <div class="field"><label>Phone *</label><input name="phone" required placeholder="07X XXX XXXX"></div>
            </div>
            <div class="field"><label>Email *</label><input type="email" name="email" required placeholder="you@example.com"><div class="hint">We email your invoice here.</div></div>
            <div class="field"><label>Address *</label><input name="address" required placeholder="House no, street"></div>
            <div class="form-row">
              <div class="field"><label>District *</label><select name="district" id="districtSel" required>${districtOptions}</select></div>
              <div class="field"><label>City / Town *</label><input name="city" required placeholder="e.g. Nugegoda"></div>
            </div>
            <div class="field"><label>Notes (optional)</label><input name="notes" placeholder="Delivery instructions"></div>
          </div>

          <div class="summary" style="position:static;margin-bottom:24px">
            <label class="gift-toggle">
              <input type="checkbox" id="giftCheck"> <span>🎁 This is a gift</span>
            </label>
            <div id="giftBox" hidden>
              <div class="field" style="margin-top:12px"><label>Gift message (optional)</label><textarea id="giftMsg" rows="3" maxlength="500" placeholder="Write a message for the lucky recipient…"></textarea></div>
              <div class="hint">Sent anonymously - we hide your name and all prices on the delivery note, so it's a perfect surprise.</div>
            </div>
          </div>

          <div class="summary" style="position:static">
            <h3>Payment Method</h3>
            <div class="pay-methods">${payHtml || '<p style="color:var(--muted)">No payment methods are available right now. Please contact us to place your order.</p>'}</div>
          </div>
        </form>

        <div class="summary">
          <h3>Your Order</h3>
          ${summaryLines}
          <div class="summary-row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:10px"><span>Subtotal</span><span>${Z.money(subtotal)}</span></div>
          <div class="summary-row"><span>Shipping${isFreeEligible ? '' : ' <small style="color:var(--muted)">(select district)</small>'}</span><span id="shipVal">${isFreeEligible ? 'Free' : '-'}</span></div>
          <div class="summary-row total"><span>Total</span><span id="totalVal">${isFreeEligible ? Z.money(subtotal) : Z.money(subtotal) + ' +'}</span></div>
          <button class="btn btn-primary btn-block btn-lg" id="placeBtn" style="margin-top:16px">Place Order</button>
          <p style="font-size:.78rem;color:var(--muted);text-align:center;margin-top:10px">By placing your order you agree to our terms. Your details are used only to process this order.</p>
        </div>
      </div>`;

    // No enabled payment methods -> block ordering.
    if (!methods.length) {
      const pb = document.getElementById('placeBtn');
      if (pb) { pb.disabled = true; pb.textContent = 'Ordering unavailable'; }
    }

    // Gift toggle reveals the message box.
    const giftCheck = document.getElementById('giftCheck');
    if (giftCheck) {
      giftCheck.addEventListener('change', () => {
        document.getElementById('giftBox').hidden = !giftCheck.checked;
      });
    }

    // payment selection highlight
    root.querySelectorAll('.pay-method').forEach((el) => {
      el.addEventListener('click', () => {
        root.querySelectorAll('.pay-method').forEach((x) => x.classList.remove('selected'));
        el.classList.add('selected');
        el.querySelector('input').checked = true;
      });
    });

    // Live shipping recompute when the district changes.
    const sel = document.getElementById('districtSel');
    function updateShipping() {
      const chosen = sel.value;
      const ship = shippingFor(subtotal, cfg, chosen);
      const shipEl = document.getElementById('shipVal');
      const totalEl = document.getElementById('totalVal');
      if (!chosen && !isFreeEligible) {
        shipEl.textContent = '-';
        totalEl.textContent = Z.money(subtotal) + ' +';
      } else {
        shipEl.textContent = ship === 0 ? 'Free' : Z.money(ship);
        totalEl.textContent = Z.money(subtotal + ship);
      }
    }
    sel.addEventListener('change', updateShipping);

    document.getElementById('placeBtn').addEventListener('click', placeOrder);
  }

  async function placeOrder() {
    const form = document.getElementById('checkoutForm');
    const btn = document.getElementById('placeBtn');
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const giftOn = (document.getElementById('giftCheck') || {}).checked;
    const customer = {
      name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'),
      address: fd.get('address'), city: fd.get('city'), district: fd.get('district'),
      notes: fd.get('notes'),
      is_gift: !!giftOn,
      gift_message: giftOn ? (document.getElementById('giftMsg').value || '') : '',
    };
    if (!customer.district) { Z.toast('Please select your district', 'error'); return; }
    const method = (root.querySelector('input[name="pay"]:checked') || {}).value || 'cod';
    const items = Cart.items().map((i) => ({ id: i.id, qty: i.qty }));

    btn.disabled = true; btn.textContent = 'Placing order…';
    try {
      const order = await Z.postJSON('/api/orders', { customer, items, payment_method: method });
      await handlePayment(method, order, customer);
    } catch (e) {
      Z.toast(e.message || 'Could not place order', 'error');
      btn.disabled = false; btn.textContent = 'Place Order';
    }
  }

  async function handlePayment(method, order, customer) {
    const cfg = window.__cfg || {};

    // WhatsApp - send order details to the store chat.
    if (method === 'whatsapp') {
      Cart.clear();
      const lines = 'New order ' + order.order_number + '\n' +
        'Total: ' + Z.money(order.total) + '\nName: ' + customer.name + '\nPhone: ' + customer.phone;
      if (cfg.whatsapp_number) {
        window.location.href = Z.whatsappUrl(cfg.whatsapp_number, lines);
      }
      setTimeout(() => { window.location.href = '/order-confirmation.html?order=' + encodeURIComponent(order.order_number); }, 400);
      return;
    }

    // Cash on delivery - straight to confirmation.
    if (method === 'cod') {
      Cart.clear();
      window.location.href = '/order-confirmation.html?order=' + encodeURIComponent(order.order_number);
      return;
    }

    // Online providers (koko / mintpay / payhere)
    const session = await Z.postJSON('/api/payments/' + method + '/init', { order_number: order.order_number });

    if (session.mode === 'sandbox') {
      // Provider not configured yet → complete in test mode.
      await Z.postJSON('/api/payments/' + method + '/sandbox-complete', { order_number: order.order_number });
      Cart.clear();
      window.location.href = '/order-confirmation.html?order=' + encodeURIComponent(order.order_number) + '&test=1';
      return;
    }

    if (session.mode === 'redirect_form') {
      Cart.clear();
      submitForm(session.action, session.fields);
      return;
    }

    if (session.mode === 'already_paid') {
      Cart.clear();
      window.location.href = '/order-confirmation.html?order=' + encodeURIComponent(order.order_number);
      return;
    }

    Z.toast('Payment could not be started', 'error');
  }

  // Build and submit a hidden form to redirect to the provider's gateway.
  function submitForm(action, fields) {
    const f = document.createElement('form');
    f.method = 'POST';
    f.action = action;
    Object.keys(fields || {}).forEach((k) => {
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = k; input.value = fields[k];
      f.appendChild(input);
    });
    document.body.appendChild(f);
    f.submit();
  }

  async function boot(cfg) {
    try { districts = await Z.getJSON('/api/shipping/districts'); } catch (e) { districts = []; }
    render(cfg);
  }

  document.addEventListener('layout:ready', (e) => boot(e.detail.config));
  if (window.__cfg) boot(window.__cfg);
})();
