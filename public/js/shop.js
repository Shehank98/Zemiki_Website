/* Shop page - category filter, search, sort */
(function () {
  'use strict';

  const state = {
    category: Z.qs('category') || '',
    q: Z.qs('q') || '',
    sort: '',
  };

  const grid = document.getElementById('shopGrid');
  const countEl = document.getElementById('resultCount');
  const sortSelect = document.getElementById('sortSelect');

  async function loadCategories() {
    const list = document.getElementById('filterList');
    try {
      const cats = await Z.getJSON('/api/categories');
      const all = `<a href="/shop.html" class="${state.category ? '' : 'active'}">All Jewelry</a>`;
      list.innerHTML = all + cats.map((c) =>
        `<a href="/shop.html?category=${encodeURIComponent(c.slug)}" class="${state.category === c.slug ? 'active' : ''}">${Z.escapeHtml(c.name)}<span>${c.product_count || 0}</span></a>`
      ).join('');

      if (state.category) {
        const match = cats.find((c) => c.slug === state.category);
        if (match) {
          document.getElementById('shopTitle').textContent = match.name;
          document.getElementById('shopSubtitle').textContent = `${match.product_count || 0} beautiful pieces`;
        }
      } else if (state.q) {
        document.getElementById('shopTitle').textContent = 'Search results';
        document.getElementById('shopSubtitle').textContent = `for “${state.q}”`;
      }
    } catch (e) {
      list.innerHTML = '<p style="color:var(--muted)">Could not load</p>';
    }
  }

  async function loadProducts() {
    grid.innerHTML = '<div class="loading"><div class="spinner"></div>Loading products…</div>';
    const params = new URLSearchParams();
    if (state.category) params.set('category', state.category);
    if (state.q) params.set('q', state.q);
    if (state.sort) params.set('sort', state.sort);
    params.set('limit', '60');
    try {
      const products = await Z.getJSON('/api/products?' + params.toString());
      countEl.textContent = `${products.length} ${products.length === 1 ? 'item' : 'items'}`;
      if (!products.length) {
        grid.innerHTML = '<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg><h3>No products found</h3><p>Try a different category or search.</p></div>';
        return;
      }
      grid.innerHTML = products.map(ZC.productCard).join('');
    } catch (e) {
      grid.innerHTML = '<div class="empty-state"><p>Could not load products.</p></div>';
    }
  }

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    loadProducts();
  });

  loadCategories();
  loadProducts();
})();
