/* Cart state - persisted in localStorage (Zemiki storefront) */
(function () {
  'use strict';

  const KEY = 'zemiki_cart_v1';

  // A cart line is a product, or a product + chosen variant (size/colour...).
  // Its key is what the cart page uses to update/remove exactly that line.
  function keyOf(i) { return String(i.id) + (i.variant_id ? ':' + i.variant_id : ''); }

  function read() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY)) || [];
      list.forEach((i) => { i.key = keyOf(i); });
      return list;
    } catch (e) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('cart:changed', { detail: { items } }));
  }

  function items() { return read(); }
  function count() { return read().reduce((n, i) => n + i.qty, 0); }
  function subtotal() { return read().reduce((s, i) => s + Number(i.price) * i.qty, 0); }

  /**
   * @param product  {id,name,slug,price,sale_price,image|images}
   * @param qty
   * @param variant  optional {id, label, sku, image, stock}
   */
  function add(product, qty, variant) {
    qty = Math.max(1, qty || 1);
    const list = read();
    const vid = variant ? variant.id : null;
    const existing = list.find((i) => i.id === product.id && (i.variant_id || null) === vid);
    const price = product.sale_price != null && product.sale_price !== ''
      ? Number(product.sale_price) : Number(product.price);
    if (existing) {
      existing.qty += qty;
      if (variant && variant.stock != null) existing.qty = Math.min(existing.qty, Math.max(1, variant.stock));
    } else {
      list.push({
        id: product.id,
        variant_id: vid,
        variant_label: variant ? variant.label : null,
        sku: variant ? variant.sku : null,
        name: product.name,
        slug: product.slug,
        price,
        image: (variant && variant.image) || product.image || (product.images && product.images[0]) || null,
        qty,
      });
    }
    write(list);
  }

  function setQty(key, qty) {
    const list = read();
    const item = list.find((i) => i.key === String(key));
    if (!item) return;
    item.qty = Math.max(1, qty);
    write(list);
  }

  function remove(key) { write(read().filter((i) => i.key !== String(key))); }
  function clear() { write([]); }

  window.Cart = { items, count, subtotal, add, setQty, remove, clear };
})();
