/* Lightweight animations + polish for the Zemiki storefront.
   Injected once by layout.js on every page. No external libraries. */
(function () {
  'use strict';

  /* --- Scroll reveal ------------------------------------------------ */
  const REVEAL_SELECTORS = [
    '.section-head', '.product-card', '.cat-card', '.trust-item',
    '.about-split > *', '.hero-copy', '.hero-art',
    '.summary', '.confirm-card', '.testimonial', '.ig-tile',
  ];

  function tagReveal(root) {
    (root || document).querySelectorAll(REVEAL_SELECTORS.join(',')).forEach((el, i) => {
      if (el.classList.contains('reveal')) return;
      // Don't reveal-hide cards inside a horizontal scroll row - off-screen
      // ones would never intersect and would stay invisible.
      if (el.closest('.scroll-row')) return;
      el.classList.add('reveal');
      // small stagger for grids
      el.style.setProperty('--reveal-delay', (Math.min(i % 8, 8) * 55) + 'ms');
      observer.observe(el);
    });
  }

  const observer = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); observer.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    : { observe: (el) => el.classList.add('in'), unobserve: function () {} };

  // Re-tag after dynamic content loads (product grids, category grid, etc.)
  function retag() { tagReveal(document); }

  /* --- Header shadow on scroll ------------------------------------- */
  function onScroll() {
    const header = document.querySelector('.site-header');
    if (header) header.classList.toggle('scrolled', window.scrollY > 10);
    const btt = document.getElementById('backToTop');
    if (btt) btt.classList.toggle('show', window.scrollY > 400);
  }

  /* --- Back to top -------------------------------------------------- */
  function buildBackToTop() {
    const btn = document.createElement('button');
    btn.id = 'backToTop';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.appendChild(btn);
  }

  /* --- Sticky mini-cart bar ---------------------------------------- */
  const HIDE_MINICART_ON = ['/cart.html', '/checkout.html', '/order-confirmation.html'];

  function buildMiniCart() {
    if (HIDE_MINICART_ON.some((p) => location.pathname.endsWith(p))) return;
    const bar = document.createElement('div');
    bar.id = 'miniCart';
    bar.innerHTML =
      '<div class="mini-cart-inner">' +
      '<span class="mini-cart-info"></span>' +
      '<a class="btn btn-gold" href="/cart.html">View Cart</a>' +
      '</div>';
    document.body.appendChild(bar);
    updateMiniCart();
    document.addEventListener('cart:changed', updateMiniCart);
  }

  function updateMiniCart() {
    const bar = document.getElementById('miniCart');
    if (!bar || !window.Cart) return;
    const count = Cart.count();
    if (count <= 0) {
      bar.classList.remove('show');
      document.body.classList.remove('has-minicart');
      return;
    }
    const info = bar.querySelector('.mini-cart-info');
    info.innerHTML = '<strong>' + count + '</strong> item' + (count > 1 ? 's' : '') +
      ' &middot; ' + (window.Z ? Z.money(Cart.subtotal()) : Cart.subtotal());
    bar.classList.add('show');
    // Reserve space so the fixed bar never covers footer content on mobile.
    document.body.classList.add('has-minicart');
  }

  /* --- Cart badge bounce ------------------------------------------- */
  function bounceBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    badge.classList.remove('bounce');
    // force reflow to restart the animation
    void badge.offsetWidth;
    badge.classList.add('bounce');
  }

  /* --- Init --------------------------------------------------------- */
  function init() {
    tagReveal(document);
    buildBackToTop();
    buildMiniCart();
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('cart:changed', bounceBadge);
    // Content that renders after fetch (grids) - re-tag a few times.
    setTimeout(retag, 400);
    setTimeout(retag, 1200);
    document.addEventListener('layout:ready', () => setTimeout(retag, 200));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Anim = { retag };
})();
