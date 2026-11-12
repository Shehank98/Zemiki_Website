/* Shared API + utility helpers (Zemiki storefront) */
(function () {
  'use strict';

  const cache = {};

  async function getJSON(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error((await safeErr(res)) || res.statusText);
    return res.json();
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await safeErr(res)) || res.statusText);
    return res.json();
  }

  async function safeErr(res) {
    try { const j = await res.json(); return j.error; } catch (e) { return null; }
  }

  async function getConfig() {
    if (cache.config) return cache.config;
    cache.config = await getJSON('/api/config');
    return cache.config;
  }

  function money(value) {
    const n = Number(value) || 0;
    return 'Rs. ' + n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  let toastRoot;
  function toast(message, type) {
    if (!toastRoot) {
      toastRoot = document.createElement('div');
      toastRoot.className = 'toast-wrap';
      document.body.appendChild(toastRoot);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = message;
    toastRoot.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2400);
    setTimeout(() => el.remove(), 2800);
  }

  // Placeholder SVG shown when a product/category has no image.
  function placeholder(kind) {
    return '<div class="ph">' +
      '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">' +
      '<path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.8 7.2 17l.9-5.4L4.2 7.7l5.4-.8z"/></svg></div>';
  }

  function whatsappUrl(number, text) {
    const clean = String(number || '').replace(/[^0-9]/g, '');
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  }

  // "tx,ty,zoom" (set by the admin crop tool) -> inline CSS variables for an <img>.
  function cropStyle(crop) {
    const m = String(crop || '').split(',').map(Number);
    if (m.length !== 3 || m.some((n) => !isFinite(n)) || m[2] <= 1) return '';
    return ` style="--tx:${m[0]}%;--ty:${m[1]}%;--cs:${m[2]}"`;
  }

  // Ask Google Drive for a thumbnail sized for where the image is shown
  // (the stored link asks for w1200, far larger than a product card needs).
  function img(url, w) {
    return String(url || '').replace(/(drive\.google\.com\/thumbnail\?[^"']*?)sz=w\d+/, '$1sz=w' + w);
  }

  // Connect every <label> to the input in the same .field (adds ids + "for"), so
  // tapping a label focuses its field and screen readers announce it.
  let lblSeq = 0;
  function linkLabels(root) {
    (root || document).querySelectorAll('.field').forEach((f) => {
      const lab = f.querySelector('label:not([for])');
      const ctl = f.querySelector('input:not([type=hidden]), select, textarea');
      if (!lab || !ctl || lab.contains(ctl)) return;
      if (!ctl.id) ctl.id = 'f' + (++lblSeq) + '_' + (ctl.name || 'field');
      lab.setAttribute('for', ctl.id);
    });
  }

  window.Z = { linkLabels, img, cropStyle, getJSON, postJSON, getConfig, money, escapeHtml, qs, toast, placeholder, whatsappUrl };
})();
