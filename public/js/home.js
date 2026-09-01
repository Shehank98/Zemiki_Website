/* Home page - load categories + featured products */
(function () {
  'use strict';

  // Apply admin-editable hero content from site config.
  function applyHero(cfg) {
    const h = (cfg && cfg.hero) || {};
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
    set('heroEyebrow', h.eyebrow);
    set('heroSubtitle', h.subtitle);
    if (h.title) {
      const el = document.getElementById('heroTitle');
      if (el) {
        // Emphasise the last two words in gold to keep the accent styling.
        const words = h.title.trim().split(/\s+/);
        if (words.length > 2) {
          const head = words.slice(0, -2).join(' ');
          const tail = words.slice(-2).join(' ');
          el.innerHTML = Z.escapeHtml(head) + ' <span class="accent">' + Z.escapeHtml(tail) + '</span>';
        } else {
          el.innerHTML = '<span class="accent">' + Z.escapeHtml(h.title) + '</span>';
        }
      }
    }
    if (h.cta_text || h.cta_link) {
      const cta = document.getElementById('heroCta');
      if (cta) { if (h.cta_text) cta.textContent = h.cta_text; if (h.cta_link) cta.href = h.cta_link; }
    }
    const images = (h.images && h.images.length) ? h.images : (h.image ? [h.image] : []);
    if (images.length >= 2) buildHeroSlider(images);
    else if (images.length === 1) {
      const img = document.getElementById('heroImage');
      if (img) img.src = images[0];
    }
  }

  // Build an auto-rotating crossfade slider (with dots) inside the hero art frame.
  let heroTimer = null;
  function buildHeroSlider(images) {
    const art = document.querySelector('.hero-art');
    if (!art) return;
    art.innerHTML =
      images.map((src, i) =>
        `<img class="hero-slide ${i === 0 ? 'active' : ''}" src="${Z.escapeHtml(src)}" alt="Zemiki jewelry" onerror="this.remove()">`).join('') +
      `<div class="hero-dots">${images.map((_, i) =>
        `<button type="button" data-i="${i}" class="${i === 0 ? 'active' : ''}" aria-label="Slide ${i + 1}"></button>`).join('')}</div>`;
    const slides = Array.from(art.querySelectorAll('.hero-slide'));
    const dots = Array.from(art.querySelectorAll('.hero-dots button'));
    let idx = 0;
    const show = (n) => {
      idx = (n + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('active', i === idx));
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    };
    const start = () => { stop(); heroTimer = setInterval(() => show(idx + 1), 5000); };
    const stop = () => { if (heroTimer) clearInterval(heroTimer); };
    dots.forEach((d) => d.addEventListener('click', () => { show(+d.dataset.i); start(); }));
    start();
  }

  // Admin-managed testimonials (falls back to the static ones on empty/error).
  async function loadTestimonials() {
    const grid = document.getElementById('testimonialsGrid');
    if (!grid) return;
    try {
      const list = await Z.getJSON('/api/testimonials');
      if (!list.length) return;
      grid.innerHTML = list.map((t) => {
        const stars = '★★★★★'.slice(0, Math.max(1, Math.min(5, Number(t.rating) || 5)));
        return `<figure class="testimonial">
          <div class="stars">${stars}</div>
          <blockquote>${Z.escapeHtml(t.quote)}</blockquote>
          <figcaption><strong>${Z.escapeHtml(t.name)}</strong>${t.location ? '<span>' + Z.escapeHtml(t.location) + '</span>' : ''}</figcaption>
        </figure>`;
      }).join('');
      if (window.Anim) Anim.retag();
    } catch (e) { /* keep static fallback */ }
  }

  // Config-driven pieces (hero + optional custom Instagram tiles).
  let siteCfg = window.__cfg || {};
  document.addEventListener('layout:ready', (e) => {
    siteCfg = e.detail.config || siteCfg;
    applyHero(siteCfg);
    if (siteCfg.instagram_images && siteCfg.instagram_images.length) buildGalleryFromConfig(siteCfg.instagram_images);
  });
  if (window.__cfg) applyHero(window.__cfg);

  function buildGalleryFromConfig(tiles) {
    const strip = document.getElementById('galleryStrip');
    if (!strip) return;
    strip.innerHTML = tiles.slice(0, 8).map((t) => {
      const href = t.link || '#';
      return `<a class="ig-tile" href="${Z.escapeHtml(href)}" ${t.link ? 'target="_blank" rel="noopener"' : ''} aria-label="Zemiki">
          <img src="${Z.escapeHtml(t.image)}" alt="Zemiki" loading="lazy" onerror="this.closest('.ig-tile').style.display='none'">
          <span class="ig-overlay"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.5" cy="6.5" r="1"/></svg></span>
        </a>`;
    }).join('');
    strip.dataset.custom = '1';
    if (window.Anim) Anim.retag();
  }

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
    if (!strip || strip.dataset.custom === '1') return; // admin-set tiles take priority
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
  loadTestimonials();
})();
