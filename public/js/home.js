/* Home page - load categories + featured products */
(function () {
  'use strict';

  async function loadCategories() {
    const el = document.getElementById('categoryGrid');
    try {
      const cats = await Z.getJSON('/api/categories');
      if (!cats.length) { el.innerHTML = '<p class="loading">No categories yet.</p>'; return; }
      el.innerHTML = cats.slice(0, 8).map(ZC.categoryCard).join('');
      if (window.Anim) Anim.retag();
    } catch (e) {
      el.innerHTML = '<p class="loading">Could not load categories.</p>';
    }
  }

  async function loadFeatured() {
    const el = document.getElementById('featuredGrid');
    el.innerHTML = ZC.skeleton(4);
    try {
      let products = await Z.getJSON('/api/products?featured=1&limit=8');
      if (!products.length) products = await Z.getJSON('/api/products?limit=8');
      if (!products.length) {
        el.innerHTML = '<p class="loading">No products yet. Add some from the admin panel.</p>';
        return;
      }
      el.innerHTML = products.map(ZC.productCard).join('');
      if (window.Anim) Anim.retag();
    } catch (e) {
      el.innerHTML = '<p class="loading">Could not load products.</p>';
    }
  }

  // New Arrivals (newest products) + reuse the same data for the Instagram strip.
  async function loadNewArrivals() {
    const row = document.getElementById('newArrivalsRow');
    try {
      const products = await Z.getJSON('/api/products?limit=12');
      if (!products.length) { row.innerHTML = '<p class="loading">New pieces coming soon.</p>'; return; }
      row.innerHTML = products.map(ZC.productCard).join('');
      buildGallery(products);
      if (window.Anim) Anim.retag();
    } catch (e) {
      row.innerHTML = '<p class="loading">Could not load new arrivals.</p>';
    }
  }

  function buildGallery(products) {
    const strip = document.getElementById('galleryStrip');
    if (!strip) return;
    const withImg = products.filter((p) => (p.image || (p.images && p.images[0])));
    if (!withImg.length) { strip.parentNode.parentNode.style.display = 'none'; return; }
    strip.innerHTML = withImg.slice(0, 6).map((p) => {
      const img = p.image || p.images[0];
      return `<a class="ig-tile" href="/product?slug=${encodeURIComponent(p.slug)}" aria-label="${Z.escapeHtml(p.name)}">
          <img src="${Z.escapeHtml(img)}" alt="${Z.escapeHtml(p.name)}" loading="lazy" onerror="this.closest('.ig-tile').style.display='none'">
          <span class="ig-overlay"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.5" cy="6.5" r="1"/></svg></span>
        </a>`;
    }).join('');
    if (window.Anim) Anim.retag();
  }

  loadCategories();
  loadFeatured();
  loadNewArrivals();
})();
