/* Zemiki admin panel - auth, navigation, CRUD */
(function () {
  'use strict';

  /* ----------------------------- helpers ----------------------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const money = (v) => 'Rs. ' + (Number(v) || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 });
  const fmtDate = (s) => new Date(s).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' });

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch('/api/admin' + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) {
      // The login call's own 401 means bad credentials - show the real reason,
      // not "session expired" (which is only for an expired/absent session).
      if (path === '/login') {
        let msg = 'Invalid username or password';
        try { msg = (await res.json()).error || msg; } catch (e) {}
        throw new Error(msg);
      }
      showLogin();
      throw new Error('Session expired');
    }
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).error || msg; } catch (e) {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    $('#toastWrap').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
    setTimeout(() => el.remove(), 3000);
  }

  const ph = '<div class="thumb-ph"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.8 7.2 17l.9-5.4L4.2 7.7l5.4-.8z"/></svg></div>';
  // Global fallback so failed thumbnails degrade to a placeholder without
  // needing nested quotes inside an inline onerror attribute.
  window.__thumbErr = function (el) { el.outerHTML = ph; };
  const thumb = (url, alt) => url
    ? `<img class="thumb" src="${esc(url)}" alt="${esc(alt || '')}" onerror="window.__thumbErr(this)">`
    : ph;

  /* ------------------------------ modal ------------------------------ */
  const modal = {
    open(title, bodyHtml, footHtml) {
      $('#modalTitle').textContent = title;
      $('#modalBody').innerHTML = bodyHtml;
      $('#modalFoot').innerHTML = footHtml || '';
      $('#modalBackdrop').classList.add('open');
    },
    close() { $('#modalBackdrop').classList.remove('open'); },
  };
  $('#modalClose').addEventListener('click', modal.close);
  $('#modalBackdrop').addEventListener('click', (e) => { if (e.target.id === 'modalBackdrop') modal.close(); });

  /* ------------------------------ auth ------------------------------- */
  function showLogin() { $('#loginScreen').style.display = 'grid'; $('#adminApp').style.display = 'none'; }
  function showApp() { $('#loginScreen').style.display = 'none'; $('#adminApp').style.display = 'grid'; }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginErr'); err.classList.remove('show');
    const fd = new FormData(e.target);
    try {
      await api('/login', { method: 'POST', body: { username: fd.get('username'), password: fd.get('password') } });
      showApp(); boot();
    } catch (ex) {
      err.textContent = ex.message || 'Login failed'; err.classList.add('show');
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/logout', { method: 'POST' }); } catch (e) {}
    showLogin();
  });

  // Animate a number counting up. data-money="1" formats as currency.
  function countUp(el) {
    const target = Number(el.dataset.count) || 0;
    const isMoney = el.dataset.money === '1';
    const dur = 700, start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      el.textContent = isMoney ? money(Math.round(val)) : Math.round(val).toLocaleString('en-LK');
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* --------------------------- navigation ---------------------------- */
  const titles = { dashboard: 'Dashboard', products: 'Products', categories: 'Categories', orders: 'Orders', enquiries: 'Enquiries', marketing: 'Marketing', content: 'Content', settings: 'Settings' };
  const loaders = {};
  $$('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      $$('.nav-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.view').forEach((v) => v.classList.remove('active'));
      const active = $('#view-' + view);
      active.classList.add('active');
      // view-switch animation
      active.classList.remove('view-anim');
      void active.offsetWidth;
      active.classList.add('view-anim');
      $('#viewTitle').textContent = titles[view];
      if (loaders[view]) loaders[view]();
      document.querySelector('.admin').classList.remove('nav-open'); // close mobile drawer
    });
  });

  function switchView(view) {
    const btn = $('.nav-item[data-view="' + view + '"]');
    if (btn) btn.click();
  }

  /* ---------------- sidebar collapse + mobile drawer ----------------- */
  const adminEl = () => document.querySelector('.admin');
  const collapseBtn = $('#collapseBtn');
  if (collapseBtn) {
    if (localStorage.getItem('zemikiSidebar') === 'collapsed') adminEl().classList.add('collapsed');
    collapseBtn.addEventListener('click', () => {
      const c = adminEl().classList.toggle('collapsed');
      localStorage.setItem('zemikiSidebar', c ? 'collapsed' : 'expanded');
    });
  }
  const menuBtn = $('#menuBtn');
  if (menuBtn) menuBtn.addEventListener('click', () => adminEl().classList.toggle('nav-open'));
  const sbBackdrop = $('#sidebarBackdrop');
  if (sbBackdrop) sbBackdrop.addEventListener('click', () => adminEl().classList.remove('nav-open'));

  /* ---------------------- quick action cards ------------------------- */
  $$('.qa[data-goto]').forEach((c) => c.addEventListener('click', () => {
    switchView(c.dataset.goto);
    if (c.dataset.add) setTimeout(() => { const b = $('#addProductBtn'); if (b) b.click(); }, 60);
  }));

  /* --------------------------- CSV export ---------------------------- */
  function exportCSV(filename, rows, columns) {
    if (!rows || !rows.length) { toast('Nothing to export yet', 'error'); return; }
    const esq = (v) => {
      v = v == null ? '' : String(v);
      return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const lines = [columns.map((c) => esq(c.label)).join(',')];
    rows.forEach((r) => lines.push(columns.map((c) => esq(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Exported ' + rows.length + ' rows', 'success');
  }
  const today = () => new Date().toISOString().slice(0, 10);

  function exportOrdersCSV() {
    exportCSV('zemiki-orders-' + today() + '.csv', ordersCache, [
      { label: 'Order #', key: 'order_number' },
      { label: 'Date', get: (o) => fmtDate(o.created_at) },
      { label: 'Customer', key: 'customer_name' },
      { label: 'Phone', key: 'phone' },
      { label: 'Email', key: 'email' },
      { label: 'Birthday', key: 'birthday' },
      { label: 'Country', get: (o) => o.country || 'Sri Lanka' },
      { label: 'District', key: 'district' },
      { label: 'City', key: 'city' },
      { label: 'Address', key: 'address' },
      { label: 'Items total', get: (o) => o.subtotal },
      { label: 'Shipping', get: (o) => o.shipping },
      { label: 'Total', get: (o) => o.total },
      { label: 'Payment', key: 'payment_method' },
      { label: 'Payment status', key: 'payment_status' },
      { label: 'Order status', key: 'order_status' },
      { label: 'Gift', get: (o) => (o.is_gift ? 'Yes' : '') },
    ]);
  }
  function exportProductsCSV() {
    exportCSV('zemiki-products-' + today() + '.csv', productsCache, [
      { label: 'Name', key: 'name' },
      { label: 'SKU', key: 'sku' },
      { label: 'Category', key: 'category_name' },
      { label: 'Price', key: 'price' },
      { label: 'Sale price', key: 'sale_price' },
      { label: 'Stock', key: 'stock' },
      { label: 'Featured', get: (p) => (p.featured ? 'Yes' : '') },
      { label: 'Active', get: (p) => (p.active ? 'Yes' : 'No') },
    ]);
  }
  function exportSubsCSV() {
    exportCSV('zemiki-subscribers-' + today() + '.csv', subscribersCache, [
      { label: 'Email', key: 'email' },
      { label: 'Subscribed', get: (s) => fmtDate(s.created_at) },
    ]);
  }
  [['#exportOrders', () => (ordersCache.length ? exportOrdersCSV() : loaders.orders().then(exportOrdersCSV))],
   ['#exportOrdersDash', () => (ordersCache.length ? exportOrdersCSV() : loaders.orders().then(exportOrdersCSV))],
   ['#exportProducts', exportProductsCSV],
   ['#exportSubs', exportSubsCSV],
  ].forEach(([sel, fn]) => { const b = $(sel); if (b) b.addEventListener('click', fn); });

  /* --------------------------- dashboard ----------------------------- */
  loaders.dashboard = async function () {
    try {
      const s = await api('/stats');
      const cards = [
        ['Products', s.products, 0], ['Orders', s.orders, 0],
        ['Revenue (paid)', s.revenue, 1], ['Open Enquiries', s.open_enquiries, 0],
      ];
      $('#statGrid').innerHTML = cards.map(([l, v, money0]) =>
        `<div class="stat"><div class="label">${l}</div><div class="value" data-count="${v}" data-money="${money0}">0</div></div>`).join('');
      $$('#statGrid .value').forEach(countUp);

      const rows = (s.recent_orders || []);
      $('#recentOrders').innerHTML = rows.length ? `<table><thead><tr>
        <th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead><tbody>${
        rows.map((o) => `<tr>
          <td><strong>${esc(o.order_number)}</strong></td>
          <td>${esc(o.customer_name)}</td>
          <td>${money(o.total)}</td>
          <td>${esc(o.payment_method)} ${payPill(o.payment_status)}</td>
          <td>${statusPill(o.order_status)}</td>
          <td>${fmtDate(o.created_at)}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No orders yet.</div>';

      updateBadges(s.orders, s.open_enquiries);
      loadCharts();
    } catch (e) { toast(e.message, 'error'); }
  };

  /* ----------------------------- charts ------------------------------ */
  const PALETTE = ['#5a1a2b', '#c9a24b', '#3f7d54', '#2f5ecf', '#a8842f', '#b23a48', '#7a6f66', '#8a5a2b'];
  const STATUS_COLORS = { new: '#2f5ecf', processing: '#c9a24b', shipped: '#5a8fd6', delivered: '#3f7d54', cancelled: '#b23a48' };

  function donut(rows, colorFor) {
    const total = rows.reduce((n, r) => n + Number(r.c), 0);
    if (!total) return '<div class="chart-empty">No data yet.</div>';
    const R = 60, C = 2 * Math.PI * R, cx = 80, cy = 80;
    let off = 0, segs = '';
    rows.forEach((r, i) => {
      const frac = Number(r.c) / total;
      const col = colorFor ? colorFor(r.k, i) : PALETTE[i % PALETTE.length];
      segs += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${col}" stroke-width="24"
        stroke-dasharray="${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}"
        stroke-dashoffset="${(-off * C).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
      off += frac;
    });
    const legend = rows.map((r, i) => {
      const col = colorFor ? colorFor(r.k, i) : PALETTE[i % PALETTE.length];
      return `<span class="lg"><span class="dot" style="background:${col}"></span>${esc(r.k)} (${r.c})</span>`;
    }).join('');
    return `<svg class="chart-svg" viewBox="0 0 160 160" style="max-width:180px;margin:0 auto">
      ${segs}
      <text x="80" y="76" text-anchor="middle" font-size="26" font-weight="700" fill="#5a1a2b" font-family="Playfair Display,serif">${total}</text>
      <text x="80" y="95" text-anchor="middle" font-size="10" fill="#7a6f66">total</text>
    </svg><div class="chart-legend">${legend}</div>`;
  }

  function barChart(rows, opts) {
    opts = opts || {};
    if (!rows.length || rows.every((r) => !Number(r.v))) return '<div class="chart-empty">No data yet.</div>';
    const W = 560, H = 200, padL = 44, padB = 30, padT = 10;
    const max = Math.max(1, ...rows.map((r) => Number(r.v)));
    const bw = (W - padL - 10) / rows.length;
    let bars = '', labels = '', grid = '';
    for (let g = 0; g <= 3; g++) {
      const y = padT + (H - padT - padB) * (g / 3);
      const val = Math.round(max * (1 - g / 3));
      grid += `<line x1="${padL}" y1="${y}" x2="${W}" y2="${y}" stroke="#eee"></line>
        <text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#7a6f66">${opts.money ? (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val) : val}</text>`;
    }
    rows.forEach((r, i) => {
      const h = (H - padT - padB) * (Number(r.v) / max);
      const x = padL + i * bw + bw * 0.18, y = H - padB - h, w = bw * 0.64;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3" fill="url(#gbar)"><title>${esc(r.label)}: ${opts.money ? money(r.v) : r.v}</title></rect>`;
      labels += `<text x="${(padL + i * bw + bw / 2).toFixed(1)}" y="${H - padB + 14}" text-anchor="middle" font-size="9" fill="#7a6f66">${esc(r.short || r.label)}</text>`;
    });
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}">
      <defs><linearGradient id="gbar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c9a24b"></stop><stop offset="1" stop-color="#a8842f"></stop></linearGradient></defs>
      ${grid}${bars}${labels}</svg>`;
  }

  function hbars(rows, opts) {
    opts = opts || {};
    if (!rows.length) return '<div class="chart-empty">No data yet.</div>';
    const max = Math.max(1, ...rows.map((r) => Number(r.c)));
    return '<div class="hbars">' + rows.map((r) => `
      <div class="hbar"><div class="hbar-top"><span>${esc(r.k)}</span><strong>${opts.money ? money(r.c) : r.c}</strong></div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(Number(r.c) / max * 100).toFixed(1)}%"></div></div></div>`).join('') + '</div>';
  }

  async function loadCharts() {
    const grid = $('#chartsGrid');
    if (!grid) return;
    try {
      const a = await api('/analytics');
      const rev = (a.revenue_14d || []).map((d) => ({
        label: d.day, short: d.day.slice(5), v: Number(d.revenue),
      }));
      const status = (a.orders_by_status || []);
      const pay = (a.payment_split || []);
      const top = (a.top_products || []);
      grid.innerHTML = `
        <div class="chart-card span-2">
          <h3>Revenue - last 14 days</h3><div class="chart-sub">Paid orders only, Rs.</div>
          ${barChart(rev, { money: true })}
        </div>
        <div class="chart-card">
          <h3>Orders by status</h3><div class="chart-sub">All time</div>
          ${donut(status, (k) => STATUS_COLORS[k] || '#7a6f66')}
        </div>
        <div class="chart-card">
          <h3>Payment methods</h3><div class="chart-sub">Share of orders</div>
          ${donut(pay)}
        </div>
        <div class="chart-card">
          <h3>Best sellers</h3><div class="chart-sub">Top products by units sold</div>
          ${hbars(top)}
        </div>`;
    } catch (e) { grid.innerHTML = ''; }
  }

  function updateBadges(orders, enq) {
    const ob = $('#ordersBadge'), eb = $('#enqBadge');
    if (enq > 0) { eb.textContent = enq; eb.hidden = false; } else eb.hidden = true;
  }

  function payPill(s) {
    const map = { paid: 'green', pending: 'gold', failed: 'red' };
    return `<span class="pill ${map[s] || 'grey'}">${esc(s)}</span>`;
  }
  function statusPill(s) {
    const map = { new: 'blue', processing: 'gold', shipped: 'blue', delivered: 'green', cancelled: 'red' };
    return `<span class="pill ${map[s] || 'grey'}">${esc(s)}</span>`;
  }

  /* --------------------------- categories ---------------------------- */
  let categoriesCache = [];
  loaders.categories = async function () {
    try {
      categoriesCache = await api('/categories');
      const el = $('#categoriesTable');
      el.innerHTML = categoriesCache.length ? `<table><thead><tr>
        <th>Name</th><th>Slug</th><th>Products</th><th>Order</th><th></th></tr></thead><tbody>${
        categoriesCache.map((c) => `<tr>
          <td><strong>${esc(c.name)}</strong></td>
          <td>${esc(c.slug)}</td>
          <td>${c.product_count}</td>
          <td>${c.sort_order}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn btn-outline btn-sm" data-edit-cat="${c.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-del-cat="${c.id}">Delete</button>
          </td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No categories yet.</div>';

      $$('[data-edit-cat]', el).forEach((b) => b.addEventListener('click', () => editCategory(+b.dataset.editCat)));
      $$('[data-del-cat]', el).forEach((b) => b.addEventListener('click', () => deleteCategory(+b.dataset.delCat)));
    } catch (e) { toast(e.message, 'error'); }
  };

  function categoryForm(c) {
    c = c || {};
    return `<div class="field"><label>Name *</label><input id="catName" value="${esc(c.name || '')}" placeholder="e.g. Necklaces"></div>
      <div class="field"><label>Sort order</label><input id="catSort" type="number" value="${c.sort_order || 0}"></div>
      <div class="field"><label>Category image link (optional)</label><input id="catImg" value="${esc(c.image_url || '')}" placeholder="Google Drive / image URL">
        <div class="hint">Paste a Google Drive share link or any image URL.</div></div>`;
  }

  $('#addCategoryBtn').addEventListener('click', () => {
    modal.open('Add Category', categoryForm(),
      `<button class="btn btn-outline" onclick="document.getElementById('modalBackdrop').classList.remove('open')">Cancel</button>
       <button class="btn btn-primary" id="saveCat">Save Category</button>`);
    $('#saveCat').addEventListener('click', () => saveCategory(null));
  });

  function editCategory(id) {
    const c = categoriesCache.find((x) => x.id === id);
    modal.open('Edit Category', categoryForm(c),
      `<button class="btn btn-outline" onclick="document.getElementById('modalBackdrop').classList.remove('open')">Cancel</button>
       <button class="btn btn-primary" id="saveCat">Save Changes</button>`);
    $('#saveCat').addEventListener('click', () => saveCategory(id));
  }

  async function saveCategory(id) {
    const body = { name: $('#catName').value.trim(), sort_order: parseInt($('#catSort').value, 10) || 0, image_url: $('#catImg').value.trim() };
    if (!body.name) { toast('Name is required', 'error'); return; }
    try {
      await api('/categories' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body });
      modal.close(); toast('Category saved', 'success'); loaders.categories();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteCategory(id) {
    if (!confirm('Delete this category? Products keep existing but become uncategorized.')) return;
    try { await api('/categories/' + id, { method: 'DELETE' }); toast('Deleted', 'success'); loaders.categories(); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* ---------------------------- products ----------------------------- */
  let productsCache = [];
  const LOW_STOCK = 3;
  loaders.products = async function () {
    try {
      if (!categoriesCache.length) { try { categoriesCache = await api('/categories'); } catch (e) {} }
      productsCache = await api('/products');
      renderProducts();
    } catch (e) { toast(e.message, 'error'); }
  };

  function toggleHtml(id, field, on) {
    return `<label class="toggle"><input type="checkbox" data-toggle="${field}" data-pid="${id}" ${on ? 'checked' : ''}><span class="track"></span></label>`;
  }

  function renderProducts() {
    const el = $('#productsTable');
    const term = ($('#productSearch').value || '').trim().toLowerCase();
    const list = term
      ? productsCache.filter((p) => (p.name + ' ' + (p.category_name || '') + ' ' + (p.sku || '')).toLowerCase().includes(term))
      : productsCache;

    if (!productsCache.length) {
      el.innerHTML = '<div class="empty">No products yet. Click “Add Product” to create your first listing.</div>';
      return;
    }
    el.innerHTML = list.length ? `<table><thead><tr>
      <th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Featured</th><th>Active</th><th></th></tr></thead><tbody>${
      list.map((p) => `<tr class="${p.stock <= LOW_STOCK ? 'low-stock' : ''}">
        <td>${thumb(p.images && p.images[0], p.name)}</td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.category_name || '-')}</td>
        <td>${p.sale_price != null ? `<strong>${money(p.sale_price)}</strong> <s style="color:#999">${money(p.price)}</s>` : money(p.price)}</td>
        <td class="${p.stock <= LOW_STOCK ? 'stock-low' : 'stock-ok'}">${p.stock}${p.stock <= LOW_STOCK ? ' ⚠' : ''}</td>
        <td>${toggleHtml(p.id, 'featured', p.featured)}</td>
        <td>${toggleHtml(p.id, 'active', p.active)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-outline btn-sm" data-edit-prod="${p.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-del-prod="${p.id}">Delete</button>
        </td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No products match your search.</div>';

    $$('[data-edit-prod]', el).forEach((b) => b.addEventListener('click', () => editProduct(+b.dataset.editProd)));
    $$('[data-del-prod]', el).forEach((b) => b.addEventListener('click', () => deleteProduct(+b.dataset.delProd)));
    $$('[data-toggle]', el).forEach((chk) => chk.addEventListener('change', async () => {
      const pid = +chk.dataset.pid, field = chk.dataset.toggle;
      try {
        await api('/products/' + pid, { method: 'PATCH', body: { [field]: chk.checked } });
        const prod = productsCache.find((x) => x.id === pid); if (prod) prod[field] = chk.checked;
        toast('Updated', 'success');
      } catch (e) { toast(e.message, 'error'); chk.checked = !chk.checked; }
    }));
  }

  function productForm(p) {
    p = p || {};
    const catOptions = ['<option value="">- Select category -</option>']
      .concat(categoriesCache.map((c) => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`))
      .join('');
    const images = (p.images && p.images.length ? p.images : ['']);
    return `
      <div class="field"><label>Product name *</label><input id="pName" value="${esc(p.name || '')}" placeholder="e.g. Golden Peacock Necklace"></div>
      <div class="field"><label>Description</label><textarea id="pDesc" rows="3" placeholder="Describe the piece…">${esc(p.description || '')}</textarea></div>
      <div class="grid-3">
        <div class="field"><label>Price (Rs.) *</label><input id="pPrice" type="number" step="0.01" value="${p.price != null ? p.price : ''}"></div>
        <div class="field"><label>Discount %</label><input id="pDiscount" type="number" min="0" max="100" step="1" placeholder="e.g. 20"></div>
        <div class="field"><label>Sale price (Rs.)</label><input id="pSale" type="number" step="0.01" value="${p.sale_price != null ? p.sale_price : ''}" placeholder="optional">
          <div class="hint" id="discHint"></div></div>
      </div>
      <div class="hint" style="margin:-6px 0 14px">Set a <strong>Discount %</strong> or type a <strong>Sale price</strong> - each updates the other. Leave both blank for no discount.</div>
      <div class="grid-3">
        <div class="field"><label>Category</label><select id="pCat">${catOptions}</select></div>
        <div class="field"><label>Stock</label><input id="pStock" type="number" value="${p.stock != null ? p.stock : 0}"></div>
        <div class="field"><label>SKU (optional)</label><input id="pSku" value="${esc(p.sku || '')}"></div>
      </div>
      <div class="field">
        <label>Image links (Google Drive)</label>
        <div class="hint" style="margin-bottom:8px">Paste a Drive share link (or any image URL). First image is the main photo. Share as “Anyone with the link”.</div>
        <div id="imageList">${images.map((u) => imageRow(u)).join('')}</div>
        <button type="button" class="btn btn-outline btn-sm" id="addImageBtn">+ Add another image</button>
      </div>
      <div class="check-row"><input type="checkbox" id="pFeatured" ${p.featured ? 'checked' : ''}><label for="pFeatured">Featured on homepage</label></div>
      <div class="check-row"><input type="checkbox" id="pActive" ${p.active === false ? '' : 'checked'}><label for="pActive">Active (visible in store)</label></div>`;
  }

  function imageRow(url) {
    return `<div class="image-row">
      <img class="image-preview" src="${esc(url || '')}" onerror="this.style.visibility='hidden'" ${url ? '' : 'style="visibility:hidden"'}>
      <input class="img-input" value="${esc(url || '')}" placeholder="https://drive.google.com/file/d/…">
      <button type="button" class="btn btn-danger btn-sm rm-img">✕</button>
    </div>`;
  }

  // Two-way binding between Discount % and Sale price, relative to Price.
  function wireDiscount() {
    const priceEl = $('#pPrice'), saleEl = $('#pSale'), discEl = $('#pDiscount'), hint = $('#discHint');
    const round = (n) => Math.round(n);
    function pctFromSale() {
      const price = parseFloat(priceEl.value), sale = parseFloat(saleEl.value);
      if (price > 0 && sale >= 0 && sale < price) {
        const pct = round((1 - sale / price) * 100);
        discEl.value = pct;
        hint.textContent = pct + '% off';
      } else {
        discEl.value = '';
        hint.textContent = sale && price && sale >= price ? 'Sale price must be below price' : '';
      }
    }
    function saleFromPct() {
      const price = parseFloat(priceEl.value), pct = parseFloat(discEl.value);
      if (price > 0 && pct > 0 && pct <= 100) {
        const sale = round(price * (1 - pct / 100));
        saleEl.value = sale;
        hint.textContent = pct + '% off';
      } else if (!discEl.value) {
        // clearing the % clears the sale price
        saleEl.value = '';
        hint.textContent = '';
      }
    }
    priceEl.addEventListener('input', pctFromSale);
    saleEl.addEventListener('input', pctFromSale);
    discEl.addEventListener('input', saleFromPct);
    pctFromSale(); // initialise from any existing sale price
  }

  function wireImageList() {
    const list = $('#imageList');
    list.addEventListener('input', (e) => {
      if (e.target.classList.contains('img-input')) {
        const img = e.target.parentNode.querySelector('.image-preview');
        img.src = e.target.value; img.style.visibility = e.target.value ? 'visible' : 'hidden';
      }
    });
    list.addEventListener('click', (e) => {
      if (e.target.classList.contains('rm-img')) {
        if (list.children.length > 1) e.target.closest('.image-row').remove();
        else e.target.closest('.image-row').querySelector('.img-input').value = '';
      }
    });
    $('#addImageBtn').addEventListener('click', () => {
      list.insertAdjacentHTML('beforeend', imageRow(''));
    });
  }

  $('#productSearch').addEventListener('input', renderProducts);

  $('#addProductBtn').addEventListener('click', () => {
    modal.open('Add Product', productForm(),
      `<button class="btn btn-outline" onclick="document.getElementById('modalBackdrop').classList.remove('open')">Cancel</button>
       <button class="btn btn-primary" id="saveProd">Save Product</button>`);
    wireImageList();
    wireDiscount();
    $('#saveProd').addEventListener('click', () => saveProduct(null));
  });

  async function editProduct(id) {
    try {
      const p = await api('/products/' + id);
      modal.open('Edit Product', productForm(p),
        `<button class="btn btn-outline" onclick="document.getElementById('modalBackdrop').classList.remove('open')">Cancel</button>
         <button class="btn btn-primary" id="saveProd">Save Changes</button>`);
      wireImageList();
      wireDiscount();
      $('#saveProd').addEventListener('click', () => saveProduct(id));
    } catch (e) { toast(e.message, 'error'); }
  }

  function collectProduct() {
    const images = $$('#imageList .img-input').map((i) => i.value.trim()).filter(Boolean);
    return {
      name: $('#pName').value.trim(),
      description: $('#pDesc').value,
      price: parseFloat($('#pPrice').value) || 0,
      sale_price: $('#pSale').value === '' ? null : parseFloat($('#pSale').value),
      stock: parseInt($('#pStock').value, 10) || 0,
      category_id: $('#pCat').value || null,
      sku: $('#pSku').value.trim(),
      featured: $('#pFeatured').checked,
      active: $('#pActive').checked,
      images,
    };
  }

  async function saveProduct(id) {
    const body = collectProduct();
    if (!body.name) { toast('Product name is required', 'error'); return; }
    if (!body.price && !body.sale_price) { toast('Set a price', 'error'); return; }
    const btn = $('#saveProd'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api('/products' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body });
      modal.close(); toast('Product saved', 'success'); loaders.products();
    } catch (e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Save Product'; }
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product permanently?')) return;
    try { await api('/products/' + id, { method: 'DELETE' }); toast('Deleted', 'success'); loaders.products(); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* ----------------------------- orders ------------------------------ */
  const ORDER_STATUSES = ['new', 'processing', 'shipped', 'delivered', 'cancelled'];
  const PAY_STATUSES = ['pending', 'paid', 'failed'];

  let ordersCache = [];
  loaders.orders = async function () {
    try {
      ordersCache = await api('/orders');
      renderOrders();
    } catch (e) { toast(e.message, 'error'); }
  };

  function renderOrderSummary() {
    const counts = { new: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    let revenue = 0;
    ordersCache.forEach((o) => {
      if (counts[o.order_status] !== undefined) counts[o.order_status]++;
      if (o.payment_status === 'paid' && o.order_status !== 'cancelled') revenue += Number(o.total);
    });
    $('#orderSummary').innerHTML =
      `<div class="chip"><strong>${ordersCache.length}</strong>Total orders</div>` +
      `<div class="chip"><strong>${counts.new}</strong>New</div>` +
      `<div class="chip"><strong>${counts.processing}</strong>Processing</div>` +
      `<div class="chip"><strong>${counts.delivered}</strong>Delivered</div>` +
      `<div class="chip"><strong>${money(revenue)}</strong>Paid revenue</div>`;
  }

  function renderOrders() {
    renderOrderSummary();
    const el = $('#ordersTable');
    const term = ($('#orderSearch').value || '').trim().toLowerCase();
    const status = $('#orderStatusFilter').value;
    const list = ordersCache.filter((o) => {
      if (status && o.order_status !== status) return false;
      if (term && !(o.order_number + ' ' + o.customer_name + ' ' + o.phone).toLowerCase().includes(term)) return false;
      return true;
    });

    el.innerHTML = list.length ? `<table><thead><tr>
      <th>Order</th><th>Customer</th><th>District</th><th>Total</th><th>Method</th><th>Payment</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>${
      list.map((o) => `<tr>
        <td><strong>${esc(o.order_number)}</strong>${o.is_gift ? ' <span class="pill gold" title="Gift order">🎁 Gift</span>' : ''}</td>
        <td>${esc(o.customer_name)}<div style="color:#999;font-size:.8rem">${esc(o.phone)}</div></td>
        <td>${esc(o.district || '-')}</td>
        <td>${money(o.total)}</td>
        <td>${esc(o.payment_method)}</td>
        <td>${payPill(o.payment_status)}</td>
        <td>${statusPill(o.order_status)}</td>
        <td style="font-size:.82rem">${fmtDate(o.created_at)}</td>
        <td style="white-space:nowrap"><button class="btn btn-outline btn-sm" data-view-order="${o.id}">View</button>
          <button class="btn btn-danger btn-sm" data-del-order="${o.id}" data-num="${esc(o.order_number)}">Delete</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No orders match.</div>';

    $$('[data-view-order]', el).forEach((b) => b.addEventListener('click', () => viewOrder(+b.dataset.viewOrder)));
    $$('[data-del-order]', el).forEach((b) => b.addEventListener('click', () => deleteOrder(+b.dataset.delOrder, b.dataset.num)));
  }

  $('#orderSearch').addEventListener('input', renderOrders);
  $('#orderStatusFilter').addEventListener('change', renderOrders);

  async function updateOrder(id, body) {
    try {
      await api('/orders/' + id, { method: 'PATCH', body });
      const o = ordersCache.find((x) => x.id === id);
      if (o) Object.assign(o, body);
      renderOrders();
      toast('Order updated', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteOrder(id, num) {
    if (!confirm('Delete order ' + (num || '') + ' permanently? This cannot be undone.')) return;
    try {
      await api('/orders/' + id, { method: 'DELETE' });
      ordersCache = ordersCache.filter((o) => o.id !== id);
      renderOrders();
      modal.close();
      toast('Order deleted', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  let currentOrder = null;
  async function viewOrder(id) {
    try {
      const o = await api('/orders/' + id);
      currentOrder = o;
      const items = (o.items || []).map((it) => `<tr><td>${esc(it.product_name)}</td><td>${it.qty}</td><td>${money(it.unit_price)}</td><td style="text-align:right">${money(it.unit_price * it.qty)}</td></tr>`).join('');
      const waNum = String(o.phone || '').replace(/[^0-9]/g, '').replace(/^0/, '94');
      const contact =
        `<a class="btn btn-outline btn-sm" href="tel:${esc(o.phone)}">📞 Call</a> ` +
        `<a class="btn btn-outline btn-sm" href="https://wa.me/${waNum}" target="_blank" rel="noopener">💬 WhatsApp</a>` +
        (o.email ? ` <a class="btn btn-outline btn-sm" href="mailto:${esc(o.email)}">✉ Email</a>` : '');

      const giftBlock = o.is_gift
        ? `<div class="gift-note-admin">🎁 <strong>Gift order</strong> - anonymous, prices hidden on the delivery note.${o.gift_message ? `<div class="gift-msg">“${esc(o.gift_message)}”</div>` : ''}</div>`
        : '';

      const statusBtns = ['new', 'processing', 'shipped', 'delivered', 'cancelled']
        .map((s) => `<button class="btn btn-sm ${s === o.order_status ? 'btn-primary' : 'btn-outline'}" data-set-status="${s}">${s}</button>`).join(' ');
      const payBtns = ['pending', 'paid', 'failed']
        .map((s) => `<button class="btn btn-sm ${s === o.payment_status ? 'btn-primary' : 'btn-outline'}" data-set-pay="${s}">${s}</button>`).join(' ');

      modal.open('Order ' + o.order_number, `
        <div class="order-grid">
          <div>
            <div class="od-label">Customer</div>
            <div class="od-value"><strong>${esc(o.customer_name)}</strong></div>
            <div class="od-value">${esc(o.phone)}${o.email ? ' · ' + esc(o.email) : ''}</div>
            ${o.birthday ? `<div class="od-value">🎂 Birthday: ${esc(o.birthday)}</div>` : ''}
            <div style="margin-top:8px">${contact}</div>
          </div>
          <div>
            <div class="od-label">Deliver to</div>
            <div class="od-value">${esc(o.address || '-')}</div>
            <div class="od-value">${esc(o.city || '')}${o.district ? ', ' + esc(o.district) : ''}${o.country && o.country !== 'Sri Lanka' ? ' · <strong>' + esc(o.country) + '</strong>' : ''}</div>
          </div>
        </div>
        ${o.notes ? `<div class="od-notes"><strong>Note:</strong> ${esc(o.notes)}</div>` : ''}
        ${giftBlock}
        <table class="od-items"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th style="text-align:right">Total</th></tr></thead><tbody>${items}</tbody></table>
        <div class="od-totals">
          <div><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
          <div><span>Shipping</span><span>${money(o.shipping)}</span></div>
          <div class="grand"><span>Total</span><span>${money(o.total)}</span></div>
        </div>
        <div class="od-controls">
          <div><div class="od-label">Order status</div><div class="btn-row" id="statusBtns">${statusBtns}</div></div>
          <div><div class="od-label">Payment</div><div class="btn-row" id="payBtns">${esc(o.payment_method)} ${payBtns}</div></div>
        </div>
        <div style="margin-top:16px">
          <div class="od-label">Tracking / Courier ID</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">
            <input id="trackInput" value="${esc(o.tracking_id || '')}" placeholder="e.g. courier waybill number" style="flex:1;min-width:180px">
            <button class="btn btn-outline btn-sm" id="saveTrack">Save</button>
            <button class="btn btn-primary btn-sm" id="sendTrack" ${o.email ? '' : 'disabled title="No email on this order"'}>✉ Email tracking</button>
          </div>
          <div class="hint" style="margin-top:6px">Save the tracking ID, then email it to the customer (uses your Apps Script mailer).</div>
        </div>`,
        `<button class="btn btn-outline" id="printSlip">🖨 Packing slip</button>
         <button class="btn btn-gold" id="resendInv" ${o.email ? '' : 'disabled title="No email on this order"'}>✉ Resend invoice</button>
         <button class="btn btn-danger" id="delOrder">🗑 Delete</button>
         <button class="btn btn-primary" onclick="document.getElementById('modalBackdrop').classList.remove('open')">Close</button>`);

      // quick status actions
      $$('[data-set-status]').forEach((btn) => btn.addEventListener('click', async () => {
        await updateOrder(o.id, { order_status: btn.dataset.setStatus });
        viewOrder(o.id); // refresh modal
      }));
      $$('[data-set-pay]').forEach((btn) => btn.addEventListener('click', async () => {
        await updateOrder(o.id, { payment_status: btn.dataset.setPay });
        viewOrder(o.id);
      }));
      $('#resendInv') && $('#resendInv').addEventListener('click', async () => {
        const btn = $('#resendInv'); btn.disabled = true; btn.textContent = 'Sending…';
        try { await api('/orders/' + o.id + '/resend-invoice', { method: 'POST' }); toast('Invoice re-sent', 'success'); }
        catch (e) { toast(e.message, 'error'); }
        btn.disabled = false; btn.textContent = '✉ Resend invoice';
      });
      $('#printSlip') && $('#printSlip').addEventListener('click', () => printPackingSlip(o));
      $('#delOrder') && $('#delOrder').addEventListener('click', () => deleteOrder(o.id, o.order_number));

      // Save tracking ID
      $('#saveTrack') && $('#saveTrack').addEventListener('click', async () => {
        const val = $('#trackInput').value.trim();
        const btn = $('#saveTrack'); btn.disabled = true; btn.textContent = 'Saving…';
        try {
          await api('/orders/' + o.id, { method: 'PATCH', body: { tracking_id: val } });
          o.tracking_id = val;
          const co = ordersCache.find((x) => x.id === o.id); if (co) co.tracking_id = val;
          toast('Tracking ID saved', 'success');
        } catch (e) { toast(e.message, 'error'); }
        btn.disabled = false; btn.textContent = 'Save';
      });
      // Email the tracking details (saves the current value first)
      $('#sendTrack') && $('#sendTrack').addEventListener('click', async () => {
        const val = $('#trackInput').value.trim();
        if (!val) { toast('Enter a tracking ID first', 'error'); return; }
        const btn = $('#sendTrack'); btn.disabled = true; btn.textContent = 'Sending…';
        try {
          await api('/orders/' + o.id, { method: 'PATCH', body: { tracking_id: val } });
          o.tracking_id = val;
          const co = ordersCache.find((x) => x.id === o.id); if (co) co.tracking_id = val;
          await api('/orders/' + o.id + '/send-tracking', { method: 'POST' });
          toast('Tracking email sent', 'success');
        } catch (e) { toast(e.message, 'error'); }
        btn.disabled = false; btn.textContent = '✉ Email tracking';
      });
    } catch (e) { toast(e.message, 'error'); }
  }

  // Professional print-friendly packing slip to stick on the order box.
  // For gift orders, prices and the buyer's identity are hidden.
  function printPackingSlip(o) {
    const gift = o.is_gift;
    const store = (siteCfg.store_name || 'Zemiki');
    const wa = siteCfg.whatsapp_number ? ('+' + String(siteCfg.whatsapp_number).replace(/[^0-9]/g, '')) : '';
    const logoUrl = location.origin + '/assets/logo.png';
    const dateStr = new Date(o.created_at).toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
    const itemCount = (o.items || []).reduce((n, it) => n + Number(it.qty), 0);

    const rows = (o.items || []).map((it) => `
      <tr>
        <td class="it-name">${esc(it.product_name)}</td>
        <td class="it-qty">${it.qty}</td>
        ${gift ? '' : `<td class="it-price">${money(it.unit_price)}</td><td class="it-total">${money(it.unit_price * it.qty)}</td>`}
      </tr>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Packing Slip ${esc(o.order_number)}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #2b2320; margin: 0; }
      .slip { max-width: 720px; margin: 0 auto; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #c9a24b; padding-bottom: 16px; }
      .brand-logo { height: 54px; }
      .brand-word { font-family: Georgia, 'Times New Roman', serif; font-size: 30px; font-weight: bold; color: #5a1a2b; letter-spacing: .5px; }
      .brand-tag { color: #a8842f; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; }
      .doc { text-align: right; }
      .doc .title { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #7a6f66; }
      .doc .ord { font-size: 20px; font-weight: bold; color: #5a1a2b; margin-top: 2px; }
      .doc .date { font-size: 12px; color: #7a6f66; margin-top: 2px; }

      .grid { display: flex; gap: 16px; margin: 18px 0; }
      .ship { flex: 1.4; border: 2px solid #2b2320; border-radius: 10px; padding: 14px 16px; }
      .meta { flex: 1; border: 1px solid #e7e0d3; border-radius: 10px; padding: 14px 16px; background: #faf6ef; }
      .lbl { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #7a6f66; margin-bottom: 6px; }
      .ship .name { font-size: 18px; font-weight: bold; }
      .ship .addr { font-size: 15px; line-height: 1.5; margin-top: 2px; }
      .ship .phone { font-size: 15px; font-weight: bold; margin-top: 6px; }
      .meta div.row { font-size: 13px; margin-bottom: 5px; display: flex; justify-content: space-between; gap: 10px; }
      .meta .k { color: #7a6f66; }
      .meta .v { font-weight: 600; text-align: right; }

      .gift { background: #fff8ec; border: 1px dashed #c9a24b; border-radius: 10px; padding: 16px; margin: 16px 0; text-align: center; }
      .gift .g-title { font-family: Georgia, serif; color: #5a1a2b; font-size: 17px; }
      .gift .g-msg { font-style: italic; margin-top: 6px; font-size: 15px; }

      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      thead th { background: #5a1a2b; color: #fff; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; padding: 9px 12px; text-align: left; }
      thead th:nth-child(2){ text-align:center } thead th:nth-child(3),thead th:nth-child(4){ text-align:right }
      tbody td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
      .it-qty { text-align: center; } .it-price, .it-total { text-align: right; white-space: nowrap; }
      .it-total { font-weight: 600; }
      tr { page-break-inside: avoid; }

      .totals { margin-top: 10px; margin-left: auto; width: 260px; }
      .totals .row { display: flex; justify-content: space-between; padding: 4px 12px; font-size: 14px; }
      .totals .grand { border-top: 2px solid #2b2320; margin-top: 4px; padding-top: 8px; font-size: 17px; font-weight: bold; color: #5a1a2b; }
      .count { font-size: 13px; color: #7a6f66; margin-top: 10px; }

      .foot { margin-top: 24px; border-top: 1px solid #e7e0d3; padding-top: 16px; text-align: center; }
      .foot .ty { font-family: Georgia, serif; color: #5a1a2b; font-size: 18px; }
      .foot .sub { color: #7a6f66; font-size: 13px; margin-top: 4px; line-height: 1.6; }
      .pay-badge { display:inline-block; margin-top:8px; font-size:12px; color:#7a6f66 }
    </style></head>
    <body>
      <div class="slip">
        <div class="head">
          <div>
            <img class="brand-logo" src="${logoUrl}" alt="${esc(store)}"
                 onerror="this.outerHTML='<div class=&quot;brand-word&quot;>${esc(store)}</div>'">
            <div class="brand-tag">Handcrafted Jewelry</div>
          </div>
          <div class="doc">
            <div class="title">Packing Slip</div>
            <div class="ord">${esc(o.order_number)}</div>
            <div class="date">${dateStr}</div>
          </div>
        </div>

        <div class="grid">
          <div class="ship">
            <div class="lbl">Ship to</div>
            <div class="name">${esc(o.customer_name)}</div>
            <div class="addr">${esc(o.address || '')}<br>${esc(o.city || '')}${o.district ? ', ' + esc(o.district) : ''}${o.country && o.country !== 'Sri Lanka' ? '<br><strong>' + esc(o.country) + '</strong>' : ''}</div>
            <div class="phone">☎ ${esc(o.phone)}</div>
          </div>
          <div class="meta">
            <div class="row"><span class="k">Order</span><span class="v">${esc(o.order_number)}</span></div>
            <div class="row"><span class="k">Date</span><span class="v">${dateStr}</span></div>
            <div class="row"><span class="k">Payment</span><span class="v">${esc((o.payment_method || '').toUpperCase())}</span></div>
            ${gift ? '' : `<div class="row"><span class="k">Status</span><span class="v">${esc(o.payment_status)}</span></div>`}
            <div class="row"><span class="k">Items</span><span class="v">${itemCount}</span></div>
          </div>
        </div>

        ${gift ? `<div class="gift"><div class="g-title">🎁 A special gift for you</div>${o.gift_message ? `<div class="g-msg">“${esc(o.gift_message)}”</div>` : ''}</div>` : ''}

        <table>
          <thead><tr><th>Item</th><th>Qty</th>${gift ? '' : '<th>Price</th><th>Total</th>'}</tr></thead>
          <tbody>${rows}</tbody>
        </table>

        ${gift
          ? `<div class="count">${itemCount} item(s) enclosed. This is a gift - prices are intentionally not shown.</div>`
          : `<div class="totals">
               <div class="row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
               <div class="row"><span>Shipping</span><span>${money(o.shipping)}</span></div>
               <div class="row grand"><span>Total</span><span>${money(o.total)}</span></div>
             </div>`}

        <div class="foot">
          <div class="ty">Thank you for shopping with ${esc(store)}!</div>
          <div class="sub">
            We hope you love your piece. Keep it away from moisture &amp; perfume for lasting shine.<br>
            Any issue with your order? Contact us within 3 days of delivery${wa ? ' on WhatsApp <strong>' + esc(wa) + '</strong>' : ''}.
          </div>
          ${gift ? '' : '<div class="pay-badge">Pay in 3 with KOKO &middot; Bank Transfer &middot; Cash on Delivery</div>'}
        </div>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else toast('Allow pop-ups to print the packing slip', 'error');
  }

  /* ---------------------------- enquiries ---------------------------- */
  loaders.enquiries = async function () {
    try {
      const list = await api('/enquiries');
      const el = $('#enquiriesTable');
      el.innerHTML = list.length ? `<table><thead><tr>
        <th>Name</th><th>Contact</th><th>Message</th><th>Product</th><th>Date</th><th></th></tr></thead><tbody>${
        list.map((e) => `<tr style="${e.handled ? 'opacity:.55' : ''}">
          <td><strong>${esc(e.name)}</strong></td>
          <td style="font-size:.85rem">${esc(e.phone || '')}<br>${esc(e.email || '')}</td>
          <td style="max-width:320px">${esc(e.message)}</td>
          <td>${esc(e.product_name || '-')}</td>
          <td style="font-size:.82rem">${fmtDate(e.created_at)}</td>
          <td><button class="btn btn-outline btn-sm" data-toggle-enq="${e.id}" data-handled="${e.handled}">${e.handled ? 'Reopen' : 'Mark done'}</button></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No enquiries yet.</div>';
      $$('[data-toggle-enq]', el).forEach((b) => b.addEventListener('click', async () => {
        try { await api('/enquiries/' + b.dataset.toggleEnq, { method: 'PATCH', body: { handled: b.dataset.handled !== 'true' } }); loaders.enquiries(); loaders.dashboard && refreshBadges(); }
        catch (ex) { toast(ex.message, 'error'); }
      }));
    } catch (e) { toast(e.message, 'error'); }
  };

  async function refreshBadges() {
    try { const s = await api('/stats'); updateBadges(s.orders, s.open_enquiries); } catch (e) {}
  }

  /* ---------------------------- marketing ---------------------------- */
  let subscribersCache = [];
  loaders.marketing = async function () {
    const el = $('#subscribersTable');
    try {
      const subs = await api('/subscribers');
      subscribersCache = subs;
      $('#subCount').textContent = subs.length + ' subscriber' + (subs.length === 1 ? '' : 's');
      el.innerHTML = subs.length ? `<table><thead><tr><th>Email</th><th>Subscribed</th><th></th></tr></thead><tbody>${
        subs.map((s) => `<tr>
          <td><strong>${esc(s.email)}</strong></td>
          <td style="font-size:.82rem">${fmtDate(s.created_at)}</td>
          <td style="text-align:right"><button class="btn btn-danger btn-sm" data-del-sub="${s.id}">Remove</button></td>
        </tr>`).join('')}</tbody></table>`
        : '<div class="empty">No subscribers yet. The newsletter signup on the storefront feeds this list.</div>';
      $$('[data-del-sub]', el).forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Remove this subscriber?')) return;
        try { await api('/subscribers/' + b.dataset.delSub, { method: 'DELETE' }); loaders.marketing(); }
        catch (e) { toast(e.message, 'error'); }
      }));
    } catch (e) { el.innerHTML = '<div class="empty">Could not load subscribers.</div>'; }
  };

  $('#sendBroadcast').addEventListener('click', async () => {
    const body = {
      subject: $('#bcSubject').value.trim(),
      heading: $('#bcHeading').value.trim(),
      body: $('#bcBody').value.trim(),
      cta_text: $('#bcCta').value.trim(),
      cta_url: $('#bcUrl').value.trim(),
      image_url: $('#bcImage').value.trim(),
    };
    if (!body.subject || !body.body) { toast('Subject and message are required', 'error'); return; }
    if (!confirm('Send this email to all subscribers and past customers?')) return;
    const btn = $('#sendBroadcast'); btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const r = await api('/broadcast', { method: 'POST', body });
      toast('Sent to ' + r.recipients + ' recipient' + (r.recipients === 1 ? '' : 's'), 'success');
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Send to everyone';
  });

  /* ----------------------------- settings ---------------------------- */
  loaders.settings = async function () {
    try {
      const s = await api('/settings');
      $('#setFlat').value = s.shipping_flat;
      $('#setFree').value = s.free_shipping_over;
      $('#annText').value = s.announcement_text || '';
      $('#annEnabled').checked = !!s.announcement_enabled;
      $('#intlEnabled').checked = !!s.intl_enabled;
      $('#intlFlat').value = s.intl_shipping_flat || 0;
      $('#linkInstagram').value = s.instagram_url || '';
      $('#linkTiktok').value = s.tiktok_url || '';
      $('#linkFacebook').value = s.facebook_url || '';
      $('#kokoMerchant').value = s.koko_merchant_id || '';
      ['bank1_bank', 'bank1_holder', 'bank1_account', 'bank1_branch', 'bank1_code',
       'bank2_bank', 'bank2_holder', 'bank2_account', 'bank2_branch', 'bank2_code']
        .forEach((k) => { const el = $('#' + k); if (el) el.value = s[k] || ''; });
      payStatus('#kokoStatus', s.koko_merchant_id, s.koko_api_key_set);
    } catch (e) { toast(e.message, 'error'); }
    loadPaymentMethods();
    loadDistricts();
  };

  function payStatus(sel, merchant, keySet) {
    const el = $(sel); if (!el) return;
    if (merchant && keySet) { el.className = 'pill green'; el.textContent = 'Live'; }
    else { el.className = 'pill grey'; el.textContent = 'Not connected'; }
  }

  function wireSave(btnSel, label, buildBody) {
    $(btnSel).addEventListener('click', async () => {
      const btn = $(btnSel); const orig = btn.textContent;
      btn.disabled = true; btn.textContent = 'Saving…';
      try { await api('/settings', { method: 'PUT', body: buildBody() }); toast(label + ' saved', 'success'); loaders.settings(); }
      catch (e) { toast(e.message, 'error'); }
      btn.disabled = false; btn.textContent = orig;
    });
  }
  wireSave('#saveIntl', 'International settings', () => ({
    intl_enabled: $('#intlEnabled').checked,
    intl_shipping_flat: parseFloat($('#intlFlat').value) || 0,
  }));
  wireSave('#saveBanks', 'Bank accounts', () => {
    const body = {};
    ['bank1_bank', 'bank1_holder', 'bank1_account', 'bank1_branch', 'bank1_code',
     'bank2_bank', 'bank2_holder', 'bank2_account', 'bank2_branch', 'bank2_code']
      .forEach((k) => { body[k] = ($('#' + k).value || '').trim(); });
    return body;
  });
  wireSave('#saveLinks', 'Links', () => ({
    instagram_url: $('#linkInstagram').value.trim(),
    tiktok_url: $('#linkTiktok').value.trim(),
    facebook_url: $('#linkFacebook').value.trim(),
  }));
  // Generic payment-credential saver (secret only overwritten when typed).
  function wirePaymentSave(btnSel, label, merchantSel, merchantKey, secretSel, secretKey) {
    $(btnSel).addEventListener('click', async () => {
      const btn = $(btnSel); const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
      const body = {}; body[merchantKey] = $(merchantSel).value.trim();
      const secret = $(secretSel).value.trim();
      if (secret) body[secretKey] = secret;
      try { await api('/settings', { method: 'PUT', body }); toast(label + ' saved', 'success'); $(secretSel).value = ''; loaders.settings(); loadPaymentMethods(); }
      catch (e) { toast(e.message, 'error'); }
      btn.disabled = false; btn.textContent = orig;
    });
  }
  wirePaymentSave('#saveKoko', 'KOKO credentials', '#kokoMerchant', 'koko_merchant_id', '#kokoKey', 'koko_api_key');

  $('#savePassword').addEventListener('click', async () => {
    const cur = $('#pwCurrent').value, nw = $('#pwNew').value, cf = $('#pwConfirm').value;
    if (!cur || !nw) { toast('Enter your current and new password', 'error'); return; }
    if (nw.length < 6) { toast('New password must be at least 6 characters', 'error'); return; }
    if (nw !== cf) { toast('New passwords do not match', 'error'); return; }
    const btn = $('#savePassword'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api('/change-password', { method: 'POST', body: { current_password: cur, new_password: nw } });
      toast('Password changed', 'success');
      $('#pwCurrent').value = $('#pwNew').value = $('#pwConfirm').value = '';
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Change Password';
  });

  /* ----------------------------- content ----------------------------- */
  loaders.content = async function () {
    try {
      const s = await api('/settings');
      const setv = (id, v) => { const el = $(id); if (el) el.value = v == null ? '' : v; };
      setv('#cStoreName', s.store_name); setv('#cWhatsapp', s.whatsapp_number); setv('#cLogo', s.logo_url);
      setv('#cHeroEyebrow', s.hero_eyebrow); setv('#cHeroTitle', s.hero_title); setv('#cHeroSubtitle', s.hero_subtitle);
      setv('#cHeroCtaText', s.hero_cta_text); setv('#cHeroCtaLink', s.hero_cta_link);
      setv('#cHeroImage', s.hero_image); setv('#cHeroImages', s.hero_images);
      setv('#cAboutTitle', s.about_title); setv('#cAboutBody', s.about_body); setv('#cAboutImage', s.about_image);
      setv('#cContactIntro', s.contact_intro); setv('#cContactEmail', s.contact_email);
      setv('#cContactPhone', s.contact_phone); setv('#cContactAddress', s.contact_address);
      setv('#cInstagram', s.instagram_images);
    } catch (e) { toast(e.message, 'error'); }
    loadTestimonials();
  };

  wireSave('#saveStore', 'Store details', () => ({
    store_name: $('#cStoreName').value.trim(),
    whatsapp_number: $('#cWhatsapp').value.trim(),
    logo_url: $('#cLogo').value.trim(),
  }));
  wireSave('#saveHero', 'Hero', () => ({
    hero_eyebrow: $('#cHeroEyebrow').value, hero_title: $('#cHeroTitle').value,
    hero_subtitle: $('#cHeroSubtitle').value, hero_cta_text: $('#cHeroCtaText').value,
    hero_cta_link: $('#cHeroCtaLink').value, hero_image: $('#cHeroImage').value.trim(),
    hero_images: $('#cHeroImages').value,
  }));
  wireSave('#saveAbout', 'About page', () => ({
    about_title: $('#cAboutTitle').value, about_body: $('#cAboutBody').value, about_image: $('#cAboutImage').value.trim(),
  }));
  wireSave('#saveContact', 'Contact page', () => ({
    contact_intro: $('#cContactIntro').value, contact_email: $('#cContactEmail').value.trim(),
    contact_phone: $('#cContactPhone').value.trim(), contact_address: $('#cContactAddress').value.trim(),
  }));
  wireSave('#saveInstagram', 'Instagram strip', () => ({ instagram_images: $('#cInstagram').value }));

  /* --------------------------- testimonials -------------------------- */
  async function loadTestimonials() {
    const el = $('#testimonialsTable');
    try {
      const list = await api('/testimonials');
      el.innerHTML = list.length ? `<table><thead><tr>
        <th>Name</th><th>Location</th><th>Rating</th><th>Quote</th><th>Active</th><th></th></tr></thead><tbody>${
        list.map((t) => `<tr>
          <td><strong>${esc(t.name)}</strong></td>
          <td>${esc(t.location || '-')}</td>
          <td>${'★'.repeat(Math.max(1, Math.min(5, t.rating)))}</td>
          <td style="max-width:320px">${esc(t.quote)}</td>
          <td>${t.active ? '<span class="pill green">Shown</span>' : '<span class="pill grey">Hidden</span>'}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn btn-outline btn-sm" data-edit-tst="${t.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-del-tst="${t.id}">Delete</button>
          </td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No testimonials yet. Add one to show it on the home page.</div>';
      window.__testimonials = list;
      $$('[data-edit-tst]', el).forEach((b) => b.addEventListener('click', () => editTestimonial(+b.dataset.editTst)));
      $$('[data-del-tst]', el).forEach((b) => b.addEventListener('click', () => deleteTestimonial(+b.dataset.delTst)));
    } catch (e) { el.innerHTML = '<div class="empty">Could not load testimonials.</div>'; }
  }

  function testimonialForm(t) {
    t = t || {};
    return `
      <div class="grid-2">
        <div class="field"><label>Customer name *</label><input id="tstName" value="${esc(t.name || '')}"></div>
        <div class="field"><label>Location</label><input id="tstLocation" value="${esc(t.location || '')}" placeholder="e.g. Colombo"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Rating</label><select id="tstRating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${(+t.rating || 5) === n ? 'selected' : ''}>${'★'.repeat(n)} (${n})</option>`).join('')}</select></div>
        <div class="field"><label>Sort order</label><input id="tstSort" type="number" value="${t.sort_order || 0}"></div>
      </div>
      <div class="field"><label>Quote *</label><textarea id="tstQuote" rows="4">${esc(t.quote || '')}</textarea></div>
      <div class="check-row"><label class="toggle"><input type="checkbox" id="tstActive" ${t.active === false ? '' : 'checked'}><span class="track"></span></label><label for="tstActive" style="margin:0">Show on the home page</label></div>`;
  }

  $('#addTestimonialBtn').addEventListener('click', () => {
    modal.open('Add Testimonial', testimonialForm(), '<button class="btn btn-outline" id="tstCancel">Cancel</button><button class="btn btn-primary" id="tstSave">Add</button>');
    $('#tstCancel').addEventListener('click', modal.close);
    $('#tstSave').addEventListener('click', () => saveTestimonial(null));
  });
  function editTestimonial(id) {
    const t = (window.__testimonials || []).find((x) => x.id === id);
    modal.open('Edit Testimonial', testimonialForm(t), '<button class="btn btn-outline" id="tstCancel">Cancel</button><button class="btn btn-primary" id="tstSave">Save</button>');
    $('#tstCancel').addEventListener('click', modal.close);
    $('#tstSave').addEventListener('click', () => saveTestimonial(id));
  }
  async function saveTestimonial(id) {
    const body = {
      name: $('#tstName').value.trim(), location: $('#tstLocation').value.trim(),
      rating: +$('#tstRating').value, sort_order: +$('#tstSort').value,
      quote: $('#tstQuote').value.trim(), active: $('#tstActive').checked,
    };
    if (!body.name || !body.quote) { toast('Name and quote are required', 'error'); return; }
    try {
      await api('/testimonials' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body });
      modal.close(); toast('Testimonial saved', 'success'); loadTestimonials();
    } catch (e) { toast(e.message, 'error'); }
  }
  async function deleteTestimonial(id) {
    if (!confirm('Delete this testimonial?')) return;
    try { await api('/testimonials/' + id, { method: 'DELETE' }); toast('Deleted', 'success'); loadTestimonials(); }
    catch (e) { toast(e.message, 'error'); }
  }

  $('#saveAnnouncement').addEventListener('click', async () => {
    const btn = $('#saveAnnouncement'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api('/settings', { method: 'PUT', body: {
        announcement_text: $('#annText').value,
        announcement_enabled: $('#annEnabled').checked,
      } });
      toast('Announcement saved', 'success');
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Save Announcement';
  });

  async function loadPaymentMethods() {
    const el = $('#paymentsTable');
    try {
      const methods = await api('/payment-methods');
      el.innerHTML = `<table><thead><tr><th>Method</th><th>Type</th><th>Status</th><th>Show at checkout</th></tr></thead><tbody>${
        methods.map((m) => {
          const status = m.kind === 'online'
            ? (m.configured ? '<span class="pill green">Live</span>' : '<span class="pill grey">Not connected</span>')
            : '<span class="pill blue">Always available</span>';
          return `<tr>
            <td><strong>${esc(m.label)}</strong></td>
            <td>${m.kind === 'online' ? 'Online' : 'Offline'}</td>
            <td>${status}</td>
            <td><label class="toggle"><input type="checkbox" data-pm="${esc(m.id)}" ${m.enabled ? 'checked' : ''}><span class="track"></span></label></td>
          </tr>`;
        }).join('')}</tbody></table>`;
    } catch (e) { el.innerHTML = '<div class="empty">Could not load payment methods.</div>'; }
  }

  $('#savePayments').addEventListener('click', async () => {
    const btn = $('#savePayments'); btn.disabled = true; btn.textContent = 'Saving…';
    const body = {};
    $$('[data-pm]').forEach((chk) => { body[chk.dataset.pm] = chk.checked; });
    if (!Object.values(body).some(Boolean)) {
      toast('Enable at least one payment method', 'error');
      btn.disabled = false; btn.textContent = 'Save Payment Methods'; return;
    }
    try {
      await api('/payment-methods', { method: 'PUT', body });
      toast('Payment methods saved', 'success');
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Save Payment Methods';
  });

  async function loadDistricts() {
    const el = $('#districtsTable');
    try {
      const rows = await api('/shipping-rates');
      el.innerHTML = `<table><thead><tr><th>District</th><th>Delivery fee (Rs.)</th><th>Active</th></tr></thead><tbody>${
        rows.map((r) => `<tr>
          <td><strong>${esc(r.district)}</strong></td>
          <td><input type="number" min="0" step="1" data-dist-fee="${esc(r.district)}" value="${r.fee}"></td>
          <td><label class="toggle"><input type="checkbox" data-dist-active="${esc(r.district)}" ${r.active ? 'checked' : ''}><span class="track"></span></label></td>
        </tr>`).join('')}</tbody></table>`;
    } catch (e) { el.innerHTML = '<div class="empty">Could not load districts.</div>'; }
  }

  $('#saveSettings').addEventListener('click', async () => {
    const btn = $('#saveSettings'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api('/settings', { method: 'PUT', body: {
        shipping_flat: parseFloat($('#setFlat').value) || 0,
        free_shipping_over: parseFloat($('#setFree').value) || 0,
      } });
      toast('Shipping settings saved', 'success');
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Save Settings';
  });

  $('#saveDistricts').addEventListener('click', async () => {
    const btn = $('#saveDistricts'); btn.disabled = true; btn.textContent = 'Saving…';
    const rows = $$('[data-dist-fee]').map((inp) => ({
      district: inp.dataset.distFee,
      fee: parseFloat(inp.value) || 0,
      active: ($(`[data-dist-active="${CSS.escape(inp.dataset.distFee)}"]`) || {}).checked,
    }));
    try {
      await api('/shipping-rates', { method: 'PUT', body: rows });
      toast('District rates saved', 'success');
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Save District Rates';
  });

  /* ------------------------------ boot ------------------------------- */
  let siteCfg = { store_name: 'Zemiki', whatsapp_number: '' };
  async function loadSiteConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) siteCfg = await res.json();
    } catch (e) { /* keep defaults */ }
  }

  async function boot() {
    loadSiteConfig();
    loaders.dashboard();
    refreshBadges();
  }

  async function init() {
    try {
      await api('/me');
      showApp(); boot();
    } catch (e) {
      showLogin();
    }
  }

  init();
})();
