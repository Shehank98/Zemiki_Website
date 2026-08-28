/* Cart state - persisted in localStorage (Zemiki storefront) */
(function () {
  'use strict';

  const KEY = 'zemiki_cart_v1';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('cart:changed', { detail: { items } }));
  }

  function items() { return read(); }
  function count() { return read().reduce((n, i) => n + i.qty, 0); }
  function subtotal() { return read().reduce((s, i) => s + Number(i.price) * i.qty, 0); }

  function add(product, qty) {
    qty = Math.max(1, qty || 1);
    const list = read();
    const existing = list.find((i) => i.id === product.id);
    const price = product.sale_price != null && product.sale_price !== ''
      ? Number(product.sale_price) : Number(product.price);
    if (existing) {
      existing.qty += qty;
    } else {
      list.push({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price,
        image: product.image || (product.images && product.images[0]) || null,
        qty,
      });
    }
    write(list);
  }

  function setQty(id, qty) {
    const list = read();
    const item = list.find((i) => i.id === id);
    if (!item) return;
    item.qty = Math.max(1, qty);
    write(list);
  }

  function remove(id) { write(read().filter((i) => i.id !== id)); }
  function clear() { write([]); }

  window.Cart = { items, count, subtotal, add, setQty, remove, clear };
})();
