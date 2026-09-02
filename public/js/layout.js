/* Injects the shared header + footer into every storefront page.
   Reads store config (name, WhatsApp) from /api/config. */
(function () {
  'use strict';

  const brandMark =
    '<svg class="brand-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">' +
    '<path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.8 7.2 17l.9-5.4L4.2 7.7l5.4-.8z"/></svg>';

  const NAV = [
    { href: '/', label: 'Home' },
    { href: '/shop', label: 'Shop' },
    { href: '/shop?category=necklaces', label: 'Necklaces' },
    { href: '/shop?category=earrings', label: 'Earrings' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];

  function icon(name) {
    const paths = {
      search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
      cart: '<circle cx="9" cy="21" r="1.5"/><circle cx="18" cy="21" r="1.5"/><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L23 7H6"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      wa: '<path d="M12 2a9.8 9.8 0 0 0-8.4 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2zm5.3 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-1-.3-1.6-.6a9 9 0 0 1-3.5-3.1c-.3-.4-.8-1.2-.8-2.3s.6-1.6.8-1.8c.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2 0 .4-.1.5l-.3.4c-.1.1-.3.3-.1.5.1.3.6 1 1.3 1.6.9.8 1.6 1 1.8 1.1.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.1.1.5 0 .9z"/>',
    };
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
  }

  function buildHeader(cfg) {
    const path = location.pathname;
    const navHtml = NAV.map((n) => {
      const active = (n.href === '/' && path === '/') ||
        (n.href !== '/' && n.href.split('?')[0] === path && !location.search) ? ' class="active"' : '';
      return `<a href="${n.href}"${active}>${n.label}</a>`;
    }).join('');

    const header = document.createElement('div');
    const ann = cfg.announcement || {};
    const topbar = (ann.enabled && ann.text)
      ? `<div class="topbar">${Z.escapeHtml(ann.text)}</div>`
      : '';

    header.innerHTML = `
      ${topbar}
      <header class="site-header">
        <div class="wrap header-inner">
          <a class="brand" href="/" aria-label="${Z.escapeHtml(cfg.store_name || 'Zemiki')}">
            <img class="brand-logo" src="${Z.escapeHtml(cfg.logo_url || '/assets/logo.png')}" alt="${Z.escapeHtml(cfg.store_name || 'Zemiki')}" onerror="this.remove();var f=document.getElementById('brandFallback');if(f)f.hidden=false">
            <span id="brandFallback" class="brand-fallback" hidden>${brandMark}${cfg.store_name || 'Zemiki'}</span>
          </a>
          <nav class="main-nav">${navHtml}</nav>
          <div class="header-actions">
            <button class="icon-btn" id="searchToggle" aria-label="Search">${icon('search')}</button>
            <a class="icon-btn cart-btn" href="/cart" aria-label="Cart">${icon('cart')}<span class="cart-badge" id="cartBadge" hidden>0</span></a>
            <button class="icon-btn menu-toggle" id="menuToggle" aria-label="Menu">${icon('menu')}</button>
          </div>
        </div>
        <div class="search-bar" id="searchBar">
          <div class="wrap">
            <form id="searchForm">
              <input type="search" name="q" placeholder="Search for necklaces, earrings, rings..." aria-label="Search products" />
              <button class="btn btn-primary" type="submit">Search</button>
            </form>
          </div>
        </div>
      </header>
      <div class="drawer-backdrop" id="drawerBackdrop"></div>
      <aside class="drawer" id="drawer">
        <button class="icon-btn drawer-close" id="drawerClose" aria-label="Close">${icon('close')}</button>
        <div class="drawer-brand">${cfg.store_name || 'Zemiki'}</div>
        ${NAV.map((n) => `<a href="${n.href}">${n.label}</a>`).join('')}
        <div class="drawer-cta">
          <a class="btn btn-gold" href="/cart">View Cart</a>
          ${cfg.whatsapp_number ? `<a class="btn btn-whatsapp" style="margin-top:10px" href="${Z.whatsappUrl(cfg.whatsapp_number, 'Hi Zemiki')}" target="_blank" rel="noopener">Chat on WhatsApp</a>` : ''}
        </div>
      </aside>`;
    document.body.insertBefore(header, document.body.firstChild);

    // interactions
    const searchBar = document.getElementById('searchBar');
    document.getElementById('searchToggle').addEventListener('click', () => {
      searchBar.classList.toggle('open');
      if (searchBar.classList.contains('open')) searchBar.querySelector('input').focus();
    });
    document.getElementById('searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim();
      location.href = '/shop' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
    const drawer = document.getElementById('drawer');
    const backdrop = document.getElementById('drawerBackdrop');
    const openD = () => { drawer.classList.add('open'); backdrop.classList.add('open'); };
    const closeD = () => { drawer.classList.remove('open'); backdrop.classList.remove('open'); };
    document.getElementById('menuToggle').addEventListener('click', openD);
    document.getElementById('drawerClose').addEventListener('click', closeD);
    backdrop.addEventListener('click', closeD);
  }

  function buildFooter(cfg) {
    const year = new Date().getFullYear();
    const social = cfg.social || {};
    const wa = cfg.whatsapp_number
      ? `<a href="${Z.whatsappUrl(cfg.whatsapp_number, 'Hi Zemiki, I have a question')}" target="_blank" rel="noopener">WhatsApp us</a>` : '';
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="newsletter">
        <div class="wrap newsletter-inner">
          <div class="newsletter-copy">
            <h3>Join the ${Z.escapeHtml(cfg.store_name || 'Zemiki')} family</h3>
            <p>Be first to know about new arrivals and exclusive offers.</p>
          </div>
          <form id="newsletterForm" class="newsletter-form">
            <input type="email" name="email" placeholder="Your email address" aria-label="Email" required>
            <button class="btn btn-gold" type="submit">Subscribe</button>
          </form>
        </div>
      </div>
      <div class="wrap footer-grid">
        <div class="footer-brand">
          <a class="brand" href="/" aria-label="${Z.escapeHtml(cfg.store_name || 'Zemiki')}">
            <img class="footer-logo" src="${Z.escapeHtml(cfg.logo_url || '/assets/logo.png')}" alt="${Z.escapeHtml(cfg.store_name || 'Zemiki')}" onerror="var f=this.parentNode&&this.parentNode.querySelector('.brand-fallback');if(f)f.hidden=false;this.remove()">
            <span class="brand-fallback" hidden>${brandMark}${cfg.store_name || 'Zemiki'}</span>
          </a>
          <p>Handcrafted jewelry that celebrates every moment. Ethically made, elegantly designed, delivered across Sri Lanka.</p>
          <div class="social-row">
            ${social.instagram ? `<a href="${Z.escapeHtml(social.instagram)}" target="_blank" rel="noopener" aria-label="Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.5" cy="6.5" r="1"/></svg></a>` : ''}
            ${social.tiktok ? `<a href="${Z.escapeHtml(social.tiktok)}" target="_blank" rel="noopener" aria-label="TikTok"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.4 2.3 1.9 3.9 4 4.1v2.7c-1.4.1-2.8-.3-4-1v6.3a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.8a2.8 2.8 0 1 0 2 2.7V3h2.7z"/></svg></a>` : ''}
            ${social.facebook ? `<a href="${Z.escapeHtml(social.facebook)}" target="_blank" rel="noopener" aria-label="Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V6h-3c-2 0-3 1-3 3v2H8v3h3v7h3v-7h3l1-3h-4V9z"/></svg></a>` : ''}
            ${cfg.whatsapp_number ? `<a href="${Z.whatsappUrl(cfg.whatsapp_number, 'Hi Zemiki')}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">${'<path d="M12 2a9.8 9.8 0 0 0-8.4 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2z"/>'}</svg></a>` : ''}
          </div>
        </div>
        <div>
          <h4>Shop</h4>
          <a href="/shop">All Jewelry</a>
          <a href="/shop?category=necklaces">Necklaces</a>
          <a href="/shop?category=earrings">Earrings</a>
          <a href="/shop?category=bangles">Bangles</a>
          <a href="/shop?category=rings">Rings</a>
        </div>
        <div>
          <h4>Help</h4>
          <a href="/about">About Us</a>
          <a href="/contact">Contact</a>
          ${wa}
          <a href="/privacy">Privacy Policy</a>
        </div>
        <div>
          <h4>Pay Your Way</h4>
          <p style="font-size:.9rem">Split your purchase into 3 interest-free payments with <strong style="color:#e3c988">KOKO</strong>, pay by <strong style="color:#e3c988">Bank Transfer</strong>, or choose Cash on Delivery.</p>
        </div>
      </div>
      <div class="footer-bottom">© ${year} ${cfg.store_name || 'Zemiki'}. All rights reserved. · Crafted with love in Sri Lanka</div>`;
    document.body.appendChild(footer);

    const nf = document.getElementById('newsletterForm');
    if (nf) {
      nf.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = nf.email.value.trim();
        const btn = nf.querySelector('button');
        btn.disabled = true;
        try {
          await Z.postJSON('/api/subscribe', { email });
          nf.innerHTML = '<p style="margin:0;color:#e3c988;font-weight:600">✓ Thank you for subscribing!</p>';
        } catch (err) {
          Z.toast(err.message || 'Could not subscribe', 'error');
          btn.disabled = false;
        }
      });
    }
  }

  function refreshBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const c = window.Cart ? Cart.count() : 0;
    badge.textContent = c;
    badge.hidden = c === 0;
  }

  async function init() {
    let cfg = { store_name: 'Zemiki', whatsapp_number: '' };
    try { cfg = await Z.getConfig(); } catch (e) {}
    window.__cfg = cfg;
    buildHeader(cfg);
    buildFooter(cfg);
    refreshBadge();
    document.addEventListener('cart:changed', refreshBadge);
    document.dispatchEvent(new CustomEvent('layout:ready', { detail: { config: cfg } }));
    loadAnim();
  }

  // Load the animation/polish layer once, on every page that uses the layout.
  function loadAnim() {
    if (document.getElementById('zemiki-anim')) return;
    const s = document.createElement('script');
    s.id = 'zemiki-anim';
    s.src = '/js/anim.js';
    document.body.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
