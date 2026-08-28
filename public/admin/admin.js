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
    if (res.status === 401) { showLogin(); throw new Error('Session expired'); }
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

  /* --------------------------- navigation ---------------------------- */
  const titles = { dashboard: 'Dashboard', products: 'Products', categories: 'Categories', orders: 'Orders', enquiries: 'Enquiries', settings: 'Settings' };
  const loaders = {};
  $$('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      $$('.nav-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.view').forEach((v) => v.classList.remove('active'));
      $('#view-' + view).classList.add('active');
      $('#viewTitle').textContent = titles[view];
      if (loaders[view]) loaders[view]();
    });
  });

  /* --------------------------- dashboard ----------------------------- */
  loaders.dashboard = async function () {
    try {
      const s = await api('/stats');
      $('#statGrid').innerHTML = [
        ['Products', s.products], ['Orders', s.orders],
        ['Revenue (paid)', money(s.revenue)], ['Open Enquiries', s.open_enquiries],
      ].map(([l, v]) => `<div class="stat"><div class="label">${l}</div><div class="value">${v}</div></div>`).join('');

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
    } catch (e) { toast(e.message, 'error'); }
  };

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
  loaders.products = async function () {
    try {
      if (!categoriesCache.length) { try { categoriesCache = await api('/categories'); } catch (e) {} }
      productsCache = await api('/products');
      const el = $('#productsTable');
      el.innerHTML = productsCache.length ? `<table><thead><tr>
        <th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Flags</th><th></th></tr></thead><tbody>${
        productsCache.map((p) => `<tr>
          <td>${thumb(p.images && p.images[0], p.name)}</td>
          <td><strong>${esc(p.name)}</strong></td>
          <td>${esc(p.category_name || '-')}</td>
          <td>${p.sale_price != null ? `<strong>${money(p.sale_price)}</strong> <s style="color:#999">${money(p.price)}</s>` : money(p.price)}</td>
          <td>${p.stock}</td>
          <td>${p.featured ? '<span class="pill gold">Featured</span> ' : ''}${p.active ? '<span class="pill green">Active</span>' : '<span class="pill grey">Hidden</span>'}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn btn-outline btn-sm" data-edit-prod="${p.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-del-prod="${p.id}">Delete</button>
          </td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No products yet. Click “Add Product” to create your first listing.</div>';

      $$('[data-edit-prod]', el).forEach((b) => b.addEventListener('click', () => editProduct(+b.dataset.editProd)));
      $$('[data-del-prod]', el).forEach((b) => b.addEventListener('click', () => deleteProduct(+b.dataset.delProd)));
    } catch (e) { toast(e.message, 'error'); }
  };

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

  loaders.orders = async function () {
    try {
      const orders = await api('/orders');
      const el = $('#ordersTable');
      el.innerHTML = orders.length ? `<table><thead><tr>
        <th>Order</th><th>Customer</th><th>Total</th><th>Method</th><th>Payment</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>${
        orders.map((o) => `<tr>
          <td><strong>${esc(o.order_number)}</strong></td>
          <td>${esc(o.customer_name)}<div style="color:#999;font-size:.8rem">${esc(o.phone)}</div></td>
          <td>${money(o.total)}</td>
          <td>${esc(o.payment_method)}</td>
          <td><select data-pay="${o.id}">${PAY_STATUSES.map((s) => `<option ${s === o.payment_status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
          <td><select data-status="${o.id}">${ORDER_STATUSES.map((s) => `<option ${s === o.order_status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
          <td style="font-size:.82rem">${fmtDate(o.created_at)}</td>
          <td><button class="btn btn-outline btn-sm" data-view-order="${o.id}">View</button></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No orders yet.</div>';

      $$('[data-status]', el).forEach((s) => s.addEventListener('change', () => updateOrder(+s.dataset.status, { order_status: s.value })));
      $$('[data-pay]', el).forEach((s) => s.addEventListener('change', () => updateOrder(+s.dataset.pay, { payment_status: s.value })));
      $$('[data-view-order]', el).forEach((b) => b.addEventListener('click', () => viewOrder(+b.dataset.viewOrder)));
    } catch (e) { toast(e.message, 'error'); }
  };

  async function updateOrder(id, body) {
    try { await api('/orders/' + id, { method: 'PATCH', body }); toast('Order updated', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function viewOrder(id) {
    try {
      const o = await api('/orders/' + id);
      const items = (o.items || []).map((it) => `<tr><td>${esc(it.product_name)}</td><td>${it.qty}</td><td>${money(it.unit_price)}</td><td>${money(it.unit_price * it.qty)}</td></tr>`).join('');
      modal.open('Order ' + o.order_number, `
        <div class="grid-2" style="margin-bottom:16px">
          <div><strong>Customer</strong><div>${esc(o.customer_name)}</div><div>${esc(o.phone)}</div><div>${esc(o.email || '')}</div></div>
          <div><strong>Delivery</strong><div>${esc(o.address || '')}</div><div>${esc(o.city || '')}</div></div>
        </div>
        ${o.notes ? `<div class="field"><strong>Notes:</strong> ${esc(o.notes)}</div>` : ''}
        <table style="margin:10px 0"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${items}</tbody></table>
        <div style="text-align:right">
          <div>Subtotal: ${money(o.subtotal)}</div>
          <div>Shipping: ${money(o.shipping)}</div>
          <div style="font-weight:700;color:var(--maroon);font-size:1.1rem">Total: ${money(o.total)}</div>
        </div>
        <div style="margin-top:12px">Payment: ${esc(o.payment_method)} ${payPill(o.payment_status)} · ${statusPill(o.order_status)}</div>`,
        `<button class="btn btn-primary" onclick="document.getElementById('modalBackdrop').classList.remove('open')">Close</button>`);
    } catch (e) { toast(e.message, 'error'); }
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

  /* ----------------------------- settings ---------------------------- */
  loaders.settings = async function () {
    try {
      const s = await api('/settings');
      $('#setFlat').value = s.shipping_flat;
      $('#setFree').value = s.free_shipping_over;
    } catch (e) { toast(e.message, 'error'); }
  };

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

  /* ------------------------------ boot ------------------------------- */
  async function boot() {
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
