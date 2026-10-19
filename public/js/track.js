/* Customer order tracking page: /track/<secret token> */
(function () {
  'use strict';

  const root = document.getElementById('trackRoot');
  const parts = location.pathname.split('/').filter(Boolean);
  const token = parts[0] === 'track' ? (parts[1] || '') : '';
  const esc = Z.escapeHtml;

  function fmt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-LK', { hour: 'numeric', minute: '2-digit' });
  }

  function fail(msg, sub) {
    root.innerHTML = `<div class="empty-state"><h3>${esc(msg)}</h3><p>${esc(sub)}</p><a class="btn btn-primary" href="/shop">Continue shopping</a></div>`;
  }

  function headline(t) {
    if (t.cancelled) return { title: 'Order cancelled', text: 'This order has been cancelled. If you did not expect this, please contact us.' };
    const cur = t.timeline.slice().reverse().find((s) => s.state === 'current' || (s.key === 'delivered' && s.state === 'done'));
    return cur ? { title: cur.label, text: cur.hint } : { title: 'Order placed', text: 'We received your order.' };
  }

  function render(t) {
    const cfg = window.__cfg || {};
    const h = headline(t);
    const waHref = cfg.whatsapp_number
      ? Z.whatsappUrl(cfg.whatsapp_number, `Hi Zemiki, I have a question about my order ${t.order_number}.`) : '';
    document.getElementById('trackSub').textContent = 'Order ' + t.order_number;
    document.title = 'Order ' + t.order_number + ' - Zemiki';

    const steps = t.timeline.map((s) => `
      <li class="tl-step ${s.state}">
        <span class="tl-dot">${s.state === 'done' ? '✓' : ''}</span>
        <div class="tl-body">
          <div class="tl-label">${esc(s.label)}</div>
          ${s.state === 'current' ? `<div class="tl-hint">${esc(s.hint)}</div>` : ''}
          ${s.at ? `<div class="tl-time">${esc(fmt(s.at))}</div>` : ''}
        </div>
      </li>`).join('');

    const courier = (t.courier || t.tracking_id || t.courier_url) ? `
      <div class="track-card">
        <h3>Delivery details</h3>
        ${t.courier ? `<div class="kv"><span>Courier</span><strong>${esc(t.courier)}</strong></div>` : ''}
        ${t.tracking_id ? `<div class="kv"><span>Tracking number</span><strong class="mono" id="tnum">${esc(t.tracking_id)}</strong> <button type="button" class="copy-btn" id="copyT">Copy</button></div>` : ''}
        ${t.deliver_to ? `<div class="kv"><span>Delivering to</span><strong>${esc(t.deliver_to)}</strong></div>` : ''}
        ${t.courier_url ? `<a class="btn btn-gold" style="margin-top:12px" href="${esc(t.courier_url)}" target="_blank" rel="noopener noreferrer">Track with courier</a>` : ''}
      </div>` : (t.deliver_to ? `<div class="track-card"><h3>Delivery details</h3><div class="kv"><span>Delivering to</span><strong>${esc(t.deliver_to)}</strong></div></div>` : '');

    const items = t.items.map((i) => `
      <div class="track-item">
        <div><strong>${esc(i.name)}</strong>${i.variant ? `<div class="ti-var">${esc(i.variant)}${i.sku ? ' · ' + esc(i.sku) : ''}</div>` : ''}</div>
        <div class="ti-qty">× ${i.qty}</div>
      </div>`).join('');

    root.innerHTML = `
      <div class="track-layout">
        <div class="track-main">
          ${t.cancelled ? `<div class="track-cancel">${esc(h.text)}</div>` : ''}
          <div class="track-card">
            <div class="track-head">
              <div>
                <div class="eyebrow">Hi ${esc(t.first_name || 'there')}</div>
                <h2>${esc(h.title)}</h2>
                ${t.cancelled ? '' : `<p class="track-text">${esc(h.text)}</p>`}
              </div>
              <div class="track-placed">Placed<br><strong>${esc(fmt(t.placed_at))}</strong></div>
            </div>
            <ol class="timeline">${steps}</ol>
          </div>
        </div>
        <div class="track-side">
          ${courier}
          <div class="track-card">
            <h3>Your items</h3>
            ${items}
            <div class="track-total"><span>Total</span><strong>${Z.money(t.total)}</strong></div>
          </div>
          ${waHref ? `<a class="btn btn-whatsapp btn-block" href="${waHref}" target="_blank" rel="noopener">Questions? Message us on WhatsApp</a>` : ''}
        </div>
      </div>`;

    const copy = document.getElementById('copyT');
    if (copy) copy.addEventListener('click', () => {
      const v = document.getElementById('tnum').textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(
        () => Z.toast('Tracking number copied', 'success'), () => Z.toast('Copy failed', 'error'));
    });
  }

  async function load() {
    if (!token) return fail('Use your tracking link', 'Open the tracking link from your order confirmation or email to see your order.');
    try {
      render(await Z.getJSON('/api/track/' + encodeURIComponent(token)));
    } catch (e) {
      fail('Tracking link not found', 'This link may be incomplete. Please use the link from your order email.');
    }
  }

  document.addEventListener('layout:ready', () => { if (root.querySelector('.track-layout')) load(); });
  load();
})();
