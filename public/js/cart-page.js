/* Cart page — list, update quantities, summary */
(function () {
  'use strict';

  const root = document.getElementById('cartRoot');

  function shippingFor(subtotal) {
    const cfg = window.__cfg || {};
    const flat = Number(cfg.shipping_flat || 350);
    const free = Number(cfg.free_shipping_over || 0);
    if (subtotal <= 0) return 0;
    if (free > 0 && subtotal >= free) return 0;
    return flat;
  }

  function render() {
    const items = Cart.items();
    if (!items.length) {
      root.innerHTML = `
        <div class="empty-state">
          <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1"><circle cx="9" cy="21" r="1.5"/><circle cx="18" cy="21" r="1.5"/><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L23 7H6"/></svg>
          <h3>Your bag is empty</h3>
          <p>Discover something beautiful.</p>
          <a class="btn btn-primary btn-lg" href="/shop.html">Start Shopping</a>
        </div>`;
      return;
    }

    const subtotal = Cart.subtotal();
    const shipping = shippingFor(subtotal);
    const total = subtotal + shipping;

    const lines = items.map((i) => {
      const media = i.image
        ? `<img src="${Z.escapeHtml(i.image)}" alt="${Z.escapeHtml(i.name)}" onerror="this.outerHTML='<div class=&quot;ph&quot;>'+Z.placeholder()+'</div>'">`
        : `<div class="ph">${Z.placeholder()}</div>`;
      return `
        <div class="cart-line">
          ${media}
          <div>
            <h4><a href="/product.html?slug=${encodeURIComponent(i.slug)}">${Z.escapeHtml(i.name)}</a></h4>
            <div style="color:var(--muted);font-size:.88rem">${Z.money(i.price)} each</div>
            <div class="qty-stepper" style="margin-top:8px">
              <button type="button" data-dec="${i.id}">−</button>
              <input type="number" value="${i.qty}" min="1" data-qty="${i.id}">
              <button type="button" data-inc="${i.id}">+</button>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;color:var(--maroon)">${Z.money(i.price * i.qty)}</div>
            <button class="rm" data-rm="${i.id}">Remove</button>
          </div>
        </div>`;
    }).join('');

    root.innerHTML = `
      <div class="cart-layout">
        <div class="cart-lines">${lines}</div>
        <div class="summary">
          <h3>Order Summary</h3>
          <div class="summary-row"><span>Subtotal</span><span>${Z.money(subtotal)}</span></div>
          <div class="summary-row"><span>Shipping</span><span>${shipping === 0 ? 'Free' : Z.money(shipping)}</span></div>
          <div class="summary-row total"><span>Total</span><span>${Z.money(total)}</span></div>
          <a class="btn btn-primary btn-block btn-lg" href="/checkout.html" style="margin-top:16px">Proceed to Checkout</a>
          <a class="btn btn-outline btn-block" href="/shop.html" style="margin-top:10px">Continue Shopping</a>
        </div>
      </div>`;

    root.querySelectorAll('[data-inc]').forEach((b) => b.addEventListener('click', () => {
      const id = +b.dataset.inc; const it = Cart.items().find((x) => x.id === id);
      Cart.setQty(id, it.qty + 1); render();
    }));
    root.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => {
      const id = +b.dataset.dec; const it = Cart.items().find((x) => x.id === id);
      Cart.setQty(id, it.qty - 1); render();
    }));
    root.querySelectorAll('[data-qty]').forEach((inp) => inp.addEventListener('change', () => {
      Cart.setQty(+inp.dataset.qty, parseInt(inp.value, 10) || 1); render();
    }));
    root.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
      Cart.remove(+b.dataset.rm); render();
    }));
  }

  document.addEventListener('layout:ready', render);
  render();
})();
