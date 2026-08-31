/* Product detail page */
(function () {
  'use strict';

  const slug = Z.qs('slug');
  const root = document.getElementById('pdpRoot');
  let product = null;

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

  function render(p) {
    const images = p.images && p.images.length ? p.images : [];
    const mainImg = images.length
      ? `<img id="mainImage" src="${Z.escapeHtml(images[0])}" alt="${Z.escapeHtml(p.name)}" onerror="this.parentNode.innerHTML=Z.placeholder()">`
      : Z.placeholder();
    const thumbs = images.length > 1
      ? `<div class="gallery-thumbs">${images.map((src, i) =>
          `<img src="${Z.escapeHtml(src)}" data-src="${Z.escapeHtml(src)}" class="${i === 0 ? 'active' : ''}" alt="view ${i + 1}" onerror="this.style.display='none'">`).join('')}</div>`
      : '';

    const inStock = p.stock > 0;
    const cfg = window.__cfg || {};
    const waText = `Hi Zemiki, I'm interested in "${p.name}" (${location.href}). Is it available?`;
    const waHref = cfg.whatsapp_number ? Z.whatsappUrl(cfg.whatsapp_number, waText) : '#';

    const onSale = p.sale_price != null && p.sale_price !== '' && Number(p.sale_price) < Number(p.price);
    const effPrice = onSale ? Number(p.sale_price) : Number(p.price);
    const pct = onSale ? Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100) : 0;
    const three = Math.ceil(effPrice / 3);
    const lowStock = inStock && p.stock <= 5;

    root.innerHTML = `
      <div class="pdp">
        <div class="gallery">
          <div class="gallery-main">
            ${onSale ? `<span class="pdp-badge">-${pct}%</span>` : ''}
            ${mainImg}
          </div>
          ${thumbs}
        </div>
        <div class="pdp-info">
          ${p.category_name ? `<div class="eyebrow">${Z.escapeHtml(p.category_name)}</div>` : ''}
          <h1>${Z.escapeHtml(p.name)}</h1>
          <div class="pdp-rating"><span class="stars">★★★★★</span> <span class="rating-text">Loved by our customers</span></div>

          <div class="price">${priceBlock(p)}${onSale ? `<span class="save-pill">Save ${Z.money(Number(p.price) - Number(p.sale_price))}</span>` : ''}</div>

          <div class="pdp-stock ${inStock ? (lowStock ? 'low' : 'in') : 'out'}">
            ${inStock ? (lowStock ? `🔥 Only ${p.stock} left in stock` : '● In stock, ready to ship') : '● Currently unavailable'}
          </div>

          <p class="pdp-desc">${Z.escapeHtml(p.description || 'A beautiful handcrafted piece from the Zemiki collection.')}</p>

          <div class="bnpl-card">
            <div class="bnpl-lead">or <strong>3 × ${Z.money(three)}</strong> interest-free</div>
            <div class="bnpl-brands"><span>KOKO</span><span>Mintpay</span><span>PayHere</span><span>COD</span></div>
          </div>

          <div class="qty-row">
            <span class="qty-label">Quantity</span>
            <div class="qty-stepper">
              <button type="button" id="qtyMinus" aria-label="decrease">−</button>
              <input type="number" id="qtyInput" value="1" min="1" max="${Math.max(1, p.stock)}" />
              <button type="button" id="qtyPlus" aria-label="increase">+</button>
            </div>
          </div>

          <div class="pdp-actions">
            <button class="btn btn-gold btn-lg" id="addBtn" ${inStock ? '' : 'disabled'}>${inStock ? 'Add to Cart' : 'Sold Out'}</button>
            <a class="btn btn-whatsapp btn-lg" id="waBtn" href="${waHref}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
          </div>

          <div class="pdp-trust">
            <div class="pdp-trust-item"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/></svg><span>Islandwide delivery<br><small>Free over Rs. 15,000</small></span></div>
            <div class="pdp-trust-item"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Secure checkout<br><small>KOKO · Mintpay · PayHere</small></span></div>
            <div class="pdp-trust-item"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 6L9 17l-5-5"/></svg><span>Cash on Delivery<br><small>Pay when it arrives</small></span></div>
          </div>

          <div class="pdp-accordion" id="pdpAccordion">
            <details open><summary>Product details</summary><div>${Z.escapeHtml(p.description || 'A beautiful handcrafted piece from the Zemiki collection.')}${p.sku ? `<div class="acc-sku">SKU: ${Z.escapeHtml(p.sku)}</div>` : ''}</div></details>
            <details><summary>Delivery &amp; returns</summary><div>Islandwide delivery, calculated by district at checkout. Free delivery on orders over Rs. 15,000. Contact us within 3 days of delivery for any issue with your piece.</div></details>
            <details><summary>Care guide</summary><div>Keep your jewelry away from moisture, perfume and direct sunlight. Wipe gently with a soft dry cloth and store in a pouch to keep it shining.</div></details>
          </div>
        </div>
      </div>`;

    // Gallery thumbnails
    root.querySelectorAll('.gallery-thumbs img').forEach((t) => {
      t.addEventListener('click', () => {
        const main = document.getElementById('mainImage');
        if (main) main.src = t.dataset.src;
        root.querySelectorAll('.gallery-thumbs img').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
      });
    });

    // Qty stepper
    const qtyInput = document.getElementById('qtyInput');
    document.getElementById('qtyMinus').addEventListener('click', () => {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
    });
    document.getElementById('qtyPlus').addEventListener('click', () => {
      qtyInput.value = (parseInt(qtyInput.value, 10) || 1) + 1;
    });

    // Add to cart
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        Cart.add(p, parseInt(qtyInput.value, 10) || 1);
        Z.toast(p.name + ' added to cart', 'success');
      });
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
