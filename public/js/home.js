/* Home page — load categories + featured products */
(function () {
  'use strict';

  async function loadCategories() {
    const el = document.getElementById('categoryGrid');
    try {
      const cats = await Z.getJSON('/api/categories');
      if (!cats.length) { el.innerHTML = '<p class="loading">No categories yet.</p>'; return; }
      el.innerHTML = cats.slice(0, 8).map(ZC.categoryCard).join('');
    } catch (e) {
      el.innerHTML = '<p class="loading">Could not load categories.</p>';
    }
  }

  async function loadFeatured() {
    const el = document.getElementById('featuredGrid');
    try {
      let products = await Z.getJSON('/api/products?featured=1&limit=8');
      if (!products.length) products = await Z.getJSON('/api/products?limit=8');
      if (!products.length) {
        el.innerHTML = '<p class="loading">No products yet. Add some from the admin panel.</p>';
        return;
      }
      el.innerHTML = products.map(ZC.productCard).join('');
    } catch (e) {
      el.innerHTML = '<p class="loading">Could not load products.</p>';
    }
  }

  loadCategories();
  loadFeatured();
})();
