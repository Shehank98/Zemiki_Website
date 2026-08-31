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

    root.innerHTML = `
      <div class="pdp">
        <div class="gallery">
          <div class="gallery-main">${mainImg}</div>
          ${thumbs}
        </div>
        <div class="pdp-info">
          ${p.category_name ? `<div class="eyebrow">${Z.escapeHtml(p.category_name)}</div>` : ''}
          <h1>${Z.escapeHtml(p.name)}</h1>
          <div class="price">${priceBlock(p)}</div>
          <div class="${inStock ? 'stock-in' : 'stock-out'}">${inStock ? '● In stock' : '● Currently unavailable'}</div>
          <p class="pdp-desc">${Z.escapeHtml(p.description || 'A beautiful handcrafted piece from the Zemiki collection.')}</p>

          <div class="bnpl-note">💳 <strong>Pay your way:</strong> Split into 3 with KOKO or Mintpay, pay by card via PayHere, or Cash on Delivery.</div>

          <div class="qty-row">
            <div class="qty-stepper">
              <button type="button" id="qtyMinus" aria-label="decrease">−</button>
              <input type="number" id="qtyInput" value="1" min="1" max="${Math.max(1, p.stock)}" />
              <button type="button" id="qtyPlus" aria-label="increase">+</button>
            </div>
          </div>

          <div class="pdp-actions">
            <button class="btn btn-primary btn-lg" id="addBtn" ${inStock ? '' : 'disabled'}>Add to Cart</button>
            <a class="btn btn-whatsapp btn-lg" id="waBtn" href="${waHref}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
          </div>

          <div class="pdp-meta">
            ${p.sku ? `<div><strong>SKU:</strong> ${Z.escapeHtml(p.sku)}</div>` : ''}
            <div><strong>Delivery:</strong> Islandwide · Free over Rs. 15,000</div>
            <div><strong>Care:</strong> Keep away from moisture &amp; perfume for lasting shine.</div>
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
