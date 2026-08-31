/* Reusable card renderers (Zemiki storefront) */
(function () {
  'use strict';

  function productCard(p) {
    const img = p.image || (p.images && p.images[0]);
    const media = img
      ? `<img src="${Z.escapeHtml(img)}" alt="${Z.escapeHtml(p.name)}" loading="lazy" onerror="this.parentNode.innerHTML=Z.placeholder()">`
      : Z.placeholder();
    const onSale = p.sale_price != null && p.sale_price !== '' && Number(p.sale_price) < Number(p.price);
    const priceHtml = onSale
      ? `<span class="now">${Z.money(p.sale_price)}</span><span class="was">${Z.money(p.price)}</span>`
      : `<span class="now">${Z.money(p.price)}</span>`;
    const tags =
      (p.featured ? '<span class="tag">Featured</span>' : '') +
      (onSale ? '<span class="tag sale">Sale</span>' : '');
    const cat = p.category_name ? `<div class="cat">${Z.escapeHtml(p.category_name)}</div>` : '';
    return `
      <div class="product-card">
        <a class="product-media" href="/product?slug=${encodeURIComponent(p.slug)}">
          ${media}${tags}
        </a>
        <div class="product-body">
          ${cat}
          <h3><a href="/product?slug=${encodeURIComponent(p.slug)}">${Z.escapeHtml(p.name)}</a></h3>
          <div class="price">${priceHtml}</div>
          <button class="btn btn-outline" data-add='${encodeURIComponent(JSON.stringify({ id: p.id, name: p.name, slug: p.slug, price: p.price, sale_price: p.sale_price, images: img ? [img] : [] }))}'>Add to Cart</button>
        </div>
      </div>`;
  }

  function categoryCard(c) {
    const media = c.image_url
      ? `<img src="${Z.escapeHtml(c.image_url)}" alt="${Z.escapeHtml(c.name)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;cat-ph&quot;>'+Z.placeholder()+'</div>'">`
      : `<div class="cat-ph">${Z.placeholder()}</div>`;
    return `
      <a class="cat-card" href="/shop?category=${encodeURIComponent(c.slug)}">
        ${media}
        <div class="cat-label">${Z.escapeHtml(c.name)}<span>${c.product_count || 0} pieces</span></div>
      </a>`;
  }

  // Delegated "Add to Cart" handler for any productCard button on the page.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    try {
      const p = JSON.parse(decodeURIComponent(btn.getAttribute('data-add')));
      window.Cart.add(p, 1);
      Z.toast(p.name + ' added to cart', 'success');
    } catch (err) {}
  });

  // Skeleton placeholder grid shown while products load.
  function skeleton(count) {
    const card = '<div class="skeleton-card"><div class="sk-media"></div><div class="sk-line"></div><div class="sk-line short"></div></div>';
    return '<div class="skeleton-grid">' + new Array(count || 8).fill(card).join('') + '</div>';
  }

  window.ZC = { productCard, categoryCard, skeleton };
})();
