/* Product detail page */
(function () {
  'use strict';

  const slug = Z.qs('slug');
  const root = document.getElementById('pdpRoot');
  let product = null;
  const sel = { a: null, b: null };   // chosen option values
  let qtyVal = 1;
  let galIdx = 0;

  if (!slug) {
    root.innerHTML = '<div class="empty-state"><p>Product not specified.</p><a class="btn btn-primary" href="/shop">Back to shop</a></div>';
    return;
  }

  function priceBlock(p) {
    const onSale = p.sale_price != null && p.sale_price !== '' && Number(p.sale_price) < Number(p.price);
    return onSale
      ? `<span class="now">${Z.money(p.sale_price)}</span><span class="was">${Z.money(p.price)}</span>`
      : `<span class="now">${Z.money(p.price)}</span>`;
  }

  const uniq = (arr) => arr.filter((x, i) => x !== '' && arr.indexOf(x) === i);
  const variantLabel = (v) => [v.a_value, v.b_value].filter(Boolean).join(' / ');

  function render(p) {
    const items = p.image_items && p.image_items.length
      ? p.image_items
      : (p.images || []).map((u) => ({ url: u, code: '', a_value: '' }));
    const variants = p.variants || [];
    const hasVar = variants.length > 0;
    const hasB = hasVar && Boolean(p.option_b_name);
    const aVals = uniq(variants.map((v) => v.a_value));
    const bVals = uniq(variants.map((v) => v.b_value));

    if (hasVar && sel.a == null) {
      const inStockA = aVals.find((a) => variants.some((v) => v.a_value === a && v.stock > 0));
      sel.a = inStockA || aVals[0];
    }

    const slides = items.length
      ? `<div class="gallery-track" id="galTrack">${items.map((it, i) =>
          `<figure class="gal-slide">
            <img src="${Z.escapeHtml(it.url)}" alt="${Z.escapeHtml(p.name)}${it.code ? ' ' + Z.escapeHtml(it.code) : ''}" ${i === 0 ? '' : 'loading="lazy"'} onerror="this.style.visibility='hidden'">
            ${it.code ? `<figcaption class="gal-code">Item code <strong>${Z.escapeHtml(it.code)}</strong></figcaption>` : ''}
          </figure>`).join('')}</div>
        ${items.length > 1 ? `<button type="button" class="gal-nav prev" id="galPrev" aria-label="Previous image">‹</button><button type="button" class="gal-nav next" id="galNext" aria-label="Next image">›</button><div class="gal-count" id="galCount">1 / ${items.length}</div>` : ''}`
      : Z.placeholder();
    const thumbs = items.length > 1
      ? `<div class="gallery-thumbs">${items.map((it, i) =>
          `<img src="${Z.escapeHtml(it.url)}" data-i="${i}" class="${i === 0 ? 'active' : ''}" alt="view ${i + 1}" onerror="this.style.display='none'">`).join('')}</div>`
      : '';

    const cfg = window.__cfg || {};
    const waText = `Hi Zemiki, I'm interested in "${p.name}" (${location.href}). Is it available?`;
    const waHref = cfg.whatsapp_number ? Z.whatsappUrl(cfg.whatsapp_number, waText) : '#';

    const onSale = p.sale_price != null && p.sale_price !== '' && Number(p.sale_price) < Number(p.price);
    const effPrice = onSale ? Number(p.sale_price) : Number(p.price);
    const pct = onSale ? Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100) : 0;
    const three = Math.ceil(effPrice / 3);

    root.innerHTML = `
      <div class="pdp">
        <div class="gallery">
          <div class="gallery-main">
            ${onSale ? `<span class="pdp-badge">-${pct}%</span>` : ''}
            ${slides}
          </div>
          ${thumbs}
        </div>
        <div class="pdp-info">
          ${p.category_name ? `<div class="eyebrow">${Z.escapeHtml(p.category_name)}</div>` : ''}
          <h1>${Z.escapeHtml(p.name)}</h1>
          <div class="pdp-rating"><span class="stars">★★★★★</span> <span class="rating-text">Loved by our customers</span></div>

          <div class="price">${priceBlock(p)}${onSale ? `<span class="save-pill">Save ${Z.money(Number(p.price) - Number(p.sale_price))}</span>` : ''}</div>

          <div id="optionsBox"></div>
          <div class="pdp-code" id="pdpCode"></div>
          <div class="pdp-stock" id="pdpStock"></div>

          <p class="pdp-desc">${Z.escapeHtml(p.description || 'A beautiful handcrafted piece from the Zemiki collection.')}</p>

          <div class="bnpl-card">
            <div class="bnpl-lead">or <strong id="bnplAmt">3 × ${Z.money(three)}</strong> interest-free</div>
            <div class="bnpl-brands"><span>KOKO</span></div>
          </div>

          <div class="qty-row">
            <span class="qty-label">Quantity</span>
            <div class="qty-stepper">
              <button type="button" id="qtyMinus" aria-label="decrease">−</button>
              <input type="number" id="qtyInput" value="${qtyVal}" min="1" />
              <button type="button" id="qtyPlus" aria-label="increase">+</button>
            </div>
          </div>

          <div class="pdp-actions">
            <button class="btn btn-gold btn-lg" id="addBtn">Add to Cart</button>
            <a class="btn btn-whatsapp btn-lg" id="waBtn" href="${waHref}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
          </div>

          <div class="pdp-trust">
            <div class="pdp-trust-item"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/></svg><span>Islandwide delivery<br><small>Free over Rs. 15,000</small></span></div>
            <div class="pdp-trust-item"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Secure checkout<br><small>KOKO · Cash on Delivery</small></span></div>
            <div class="pdp-trust-item"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 6L9 17l-5-5"/></svg><span>Cash on Delivery<br><small>Pay when it arrives</small></span></div>
          </div>

          <div class="pdp-accordion" id="pdpAccordion">
            <details open><summary>Product details</summary><div>${Z.escapeHtml(p.description || 'A beautiful handcrafted piece from the Zemiki collection.')}${p.sku ? `<div class="acc-sku">SKU: ${Z.escapeHtml(p.sku)}</div>` : ''}</div></details>
            <details><summary>Delivery &amp; returns</summary><div>Islandwide delivery, calculated by district at checkout. Free delivery on orders over Rs. 15,000. Contact us within 3 days of delivery for any issue with your piece.</div></details>
            <details><summary>Care guide</summary><div>Keep your jewelry away from moisture, perfume and direct sunlight. Wipe gently with a soft dry cloth and store in a pouch to keep it shining.</div></details>
          </div>
        </div>
      </div>`;

    const track = document.getElementById('galTrack');
    let programmatic = false;

    function goTo(i, smooth) {
      if (!track) return;
      i = Math.max(0, Math.min(items.length - 1, i));
      programmatic = true;
      track.scrollTo({ left: i * track.clientWidth, behavior: smooth === false ? 'auto' : 'smooth' });
      setActive(i);
      clearTimeout(goTo.t);
      goTo.t = setTimeout(() => { programmatic = false; }, 700);
    }
    function setActive(i) {
      galIdx = i;
      root.querySelectorAll('.gallery-thumbs img').forEach((x, n) => x.classList.toggle('active', n === i));
      const c = document.getElementById('galCount');
      if (c) c.textContent = (i + 1) + ' / ' + items.length;
    }

    // Variant helpers
    const findV = (a, b) => variants.find((v) => v.a_value === a && (v.b_value || '') === (b || ''));
    const currentV = () => (hasVar && sel.a != null && (!hasB || sel.b) ? findV(sel.a, hasB ? sel.b : '') : null);
    const aSoldOut = (a) => !variants.some((v) => v.a_value === a && v.stock > 0);
    const bSoldOut = (b) => { const v = findV(sel.a, b); return !v || v.stock <= 0; };
    const imageForA = (a) => { const it = items.find((x) => x.a_value === a); return it ? it.url : null; };

    function pills(name, vals, key, isSoldOut) {
      return `<div class="opt-group"><div class="opt-label">${Z.escapeHtml(name)}: <strong>${Z.escapeHtml(sel[key] || 'Select')}</strong></div><div class="opt-pills">${
        vals.map((v) => `<button type="button" class="opt-pill ${sel[key] === v ? 'active' : ''} ${isSoldOut(v) ? 'soldout' : ''}" data-opt="${key}" data-val="${Z.escapeHtml(v)}">${Z.escapeHtml(v)}</button>`).join('')
      }</div></div>`;
    }

    function updateUI() {
      const v = currentV();
      let stockNow = hasVar ? (v ? v.stock : null) : p.stock;

      if (hasVar) {
        document.getElementById('optionsBox').innerHTML =
          pills(p.option_a_name, aVals, 'a', aSoldOut) +
          (hasB ? pills(p.option_b_name, bVals, 'b', bSoldOut) : '');
        document.getElementById('pdpCode').innerHTML = v && v.sku ? `Item code: <strong>${Z.escapeHtml(v.sku)}</strong>` : '';
      }

      const stockEl = document.getElementById('pdpStock');
      if (hasVar && stockNow == null) {
        stockEl.className = 'pdp-stock low';
        stockEl.textContent = 'Select a ' + (p.option_b_name || p.option_a_name).toLowerCase();
      } else if (stockNow > 0) {
        const low = stockNow <= 5;
        stockEl.className = 'pdp-stock ' + (low ? 'low' : 'in');
        stockEl.textContent = low ? `🔥 Only ${stockNow} left in stock` : '● In stock, ready to ship';
      } else {
        stockEl.className = 'pdp-stock out';
        stockEl.textContent = '● Currently unavailable';
      }

      const qtyInput = document.getElementById('qtyInput');
      const max = Math.max(1, stockNow || 1);
      qtyInput.max = max;
      qtyVal = Math.min(Math.max(1, parseInt(qtyInput.value, 10) || 1), max);
      qtyInput.value = qtyVal;

      const btn = document.getElementById('addBtn');
      if (hasVar && stockNow == null) { btn.disabled = true; btn.textContent = 'Select ' + (p.option_b_name || p.option_a_name); }
      else if (!(stockNow > 0)) { btn.disabled = true; btn.textContent = 'Sold Out'; }
      else { btn.disabled = false; btn.textContent = 'Add to Cart'; }
      if (window.__updateBnpl) window.__updateBnpl();
    }

    // Gallery interactions
    if (track) {
      let t;
      track.addEventListener('scroll', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const i = Math.round(track.scrollLeft / (track.clientWidth || 1));
          setActive(i);
          const it = items[i];
          // Swiping to a colour's photo selects that colour.
          if (!programmatic && hasVar && it && it.a_value && it.a_value !== sel.a && aVals.includes(it.a_value)) {
            sel.a = it.a_value; updateUI();
          }
        }, 110);
      }, { passive: true });
      const prev = document.getElementById('galPrev'), next = document.getElementById('galNext');
      if (prev) prev.addEventListener('click', () => goTo(galIdx - 1));
      if (next) next.addEventListener('click', () => goTo(galIdx + 1));
      root.querySelectorAll('.gallery-thumbs img').forEach((t2) => {
        t2.addEventListener('click', () => {
          const i = +t2.dataset.i;
          goTo(i);
          const it = items[i];
          if (hasVar && it && it.a_value && aVals.includes(it.a_value) && it.a_value !== sel.a) { sel.a = it.a_value; updateUI(); }
        });
      });
    }

    // Option pills
    document.getElementById('optionsBox').addEventListener('click', (e) => {
      const b = e.target.closest('.opt-pill');
      if (!b) return;
      const key = b.dataset.opt, val = b.dataset.val;
      sel[key] = val;
      if (key === 'a') {
        const i = items.findIndex((x) => x.a_value === val);
        if (i >= 0 && i !== galIdx) goTo(i);
      }
      updateUI();
    });

    // Qty stepper + live "pay in 3" amount (KOKO)
    const qtyInput = document.getElementById('qtyInput');
    const bnplAmt = document.getElementById('bnplAmt');
    const clampQty = (n) => Math.min(Math.max(1, n), parseInt(qtyInput.max, 10) || 1);
    const updateBnpl = () => {
      const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      qtyVal = qty;
      if (bnplAmt) bnplAmt.textContent = '3 × ' + Z.money(Math.ceil(effPrice * qty / 3));
    };
    window.__updateBnpl = updateBnpl;
    document.getElementById('qtyMinus').addEventListener('click', () => {
      qtyInput.value = clampQty((parseInt(qtyInput.value, 10) || 1) - 1); updateBnpl();
    });
    document.getElementById('qtyPlus').addEventListener('click', () => {
      const cur = parseInt(qtyInput.value, 10) || 1;
      if (cur >= (parseInt(qtyInput.max, 10) || 1)) { Z.toast('That is all we have in stock', 'info'); return; }
      qtyInput.value = clampQty(cur + 1); updateBnpl();
    });
    qtyInput.addEventListener('input', updateBnpl);

    // Add to cart
    document.getElementById('addBtn').addEventListener('click', () => {
      const v = currentV();
      const qty = clampQty(parseInt(qtyInput.value, 10) || 1);
      if (hasVar && !v) { Z.toast('Please choose your ' + (p.option_b_name || p.option_a_name).toLowerCase(), 'error'); return; }
      Cart.add(p, qty, v ? { id: v.id, label: variantLabel(v), sku: v.sku, image: imageForA(v.a_value), stock: v.stock } : null);
      Z.toast(p.name + (v ? ' (' + variantLabel(v) + ')' : '') + ' added to cart', 'success');
    });

    updateUI();
    // Start on the photo of the pre-selected colour.
    if (hasVar && track) {
      const i = items.findIndex((x) => x.a_value === sel.a);
      if (i > 0) goTo(i, false);
    }

    // Breadcrumb
    document.getElementById('breadcrumb').innerHTML =
      `<a href="/">Home</a> / <a href="/shop">Shop</a> / ${Z.escapeHtml(p.name)}`;
    document.title = `${p.name} - Zemiki`;
  }

  function renderRelated(list) {
    if (!list || !list.length) return;
    document.getElementById('relatedSection').hidden = false;
    document.getElementById('relatedGrid').innerHTML = list.map(ZC.productCard).join('');
  }

  async function load() {
    try {
      product = await Z.getJSON('/api/products/' + encodeURIComponent(slug));
      render(product);
      renderRelated(product.related);
    } catch (e) {
      root.innerHTML = '<div class="empty-state"><h3>Product not found</h3><p>It may have been removed.</p><a class="btn btn-primary" href="/shop">Back to shop</a></div>';
    }
  }

  // Re-render WhatsApp link once config (with number) is ready.
  document.addEventListener('layout:ready', () => { if (product) render(product); });

  load();
})();
