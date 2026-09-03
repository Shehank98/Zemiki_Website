/**
 * Zemiki mail relay - Google Apps Script web app.
 *
 * The Zemiki server POSTs JSON here and this script sends the emails with your
 * Gmail account. See docs/apps-script/README.md for step-by-step setup.
 *
 * 1) Set SECRET below to the same value you put in Railway as APPSCRIPT_SECRET.
 * 2) Deploy > New deployment > Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 3) Copy the web-app URL (ends with /exec) into Railway as APPSCRIPT_URL.
 */

var SECRET = 'CHANGE_ME_TO_MATCH_APPSCRIPT_SECRET';
var LOGO_URL = ''; // optional: a public logo image URL for the email header

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (SECRET && String(data.secret || '') !== SECRET) {
      return json({ ok: false, error: 'unauthorized' });
    }
    if (data.type === 'invoice') return handleInvoice(data);
    if (data.type === 'tracking') return handleTracking(data);
    if (data.type === 'broadcast') return handleBroadcast(data);
    return json({ ok: false, error: 'unknown type' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, service: 'zemiki-mail' });
}

/* ------------------------------ helpers ------------------------------ */

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function money(n) {
  n = Math.round(Number(n) || 0);
  return 'Rs. ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shell(store, inner) {
  var head = LOGO_URL
    ? '<img src="' + LOGO_URL + '" alt="' + esc(store.store_name) + '" style="height:44px">'
    : '<div style="font-family:Georgia,serif;font-size:26px;color:#5a1a2b;font-weight:bold">' + esc(store.store_name) + '</div>';
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;color:#2b2320">' +
    '<div style="text-align:center;padding:24px 0;border-bottom:3px solid #c9a24b">' + head + '</div>' +
    '<div style="padding:24px 20px">' + inner + '</div>' +
    '<div style="text-align:center;padding:18px;color:#999;font-size:12px;border-top:1px solid #eee">' +
    '&copy; ' + new Date().getFullYear() + ' ' + esc(store.store_name) + ' &middot; Crafted with love in Sri Lanka</div>' +
    '</div>';
}

/* ------------------------------ invoice ------------------------------ */

function handleInvoice(data) {
  var o = data.order, store = data.store || {};
  if (!o || !o.email) return json({ ok: false, error: 'no email' });

  var rows = (o.items || []).map(function (i) {
    return '<tr><td style="padding:8px;border-bottom:1px solid #eee">' + esc(i.name) +
      '</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">' + i.qty +
      '</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">' + money(i.unit_price * i.qty) + '</td></tr>';
  }).join('');

  var inner =
    '<h2 style="font-family:Georgia,serif;color:#5a1a2b;margin:0 0 4px">Thank you for your order!</h2>' +
    '<p style="color:#777;margin:0 0 18px">Order <strong>' + esc(o.order_number) + '</strong></p>' +
    (o.is_gift ? '<p style="background:#fff8ec;border:1px dashed #c9a24b;border-radius:8px;padding:10px 14px">🎁 This order is being sent as a gift.</p>' : '') +
    '<table style="width:100%;border-collapse:collapse;margin:10px 0">' +
    '<tr><th style="text-align:left;padding:8px;border-bottom:2px solid #eee">Item</th>' +
    '<th style="padding:8px;border-bottom:2px solid #eee">Qty</th>' +
    '<th style="text-align:right;padding:8px;border-bottom:2px solid #eee">Total</th></tr>' + rows + '</table>' +
    '<table style="width:100%;margin-top:10px"><tr><td style="text-align:right;color:#555">Subtotal:&nbsp;</td>' +
    '<td style="text-align:right;width:120px">' + money(o.subtotal) + '</td></tr>' +
    '<tr><td style="text-align:right;color:#555">Shipping:&nbsp;</td><td style="text-align:right">' + money(o.shipping) + '</td></tr>' +
    '<tr><td style="text-align:right;font-weight:bold;color:#5a1a2b;font-size:16px">Total:&nbsp;</td>' +
    '<td style="text-align:right;font-weight:bold;color:#5a1a2b;font-size:16px">' + money(o.total) + '</td></tr></table>' +
    '<div style="margin-top:20px;padding:14px;background:#faf6ef;border-radius:8px">' +
    '<strong>Delivery</strong><br>' + esc(o.customer_name) + '<br>' + esc(o.address || '') + '<br>' +
    esc(o.city || '') + (o.district ? ', ' + esc(o.district) : '') + '<br>' + esc(o.phone) +
    '<br><span style="color:#777">Payment: ' + esc(o.payment_method) + ' (' + esc(o.payment_status) + ')</span></div>' +
    (store.whatsapp_number ? '<p style="text-align:center;margin-top:20px"><a href="https://wa.me/' + esc(store.whatsapp_number) + '" style="background:#25d366;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Message us on WhatsApp</a></p>' : '');

  MailApp.sendEmail({
    to: o.email,
    subject: (store.store_name || 'Zemiki') + ' - Order ' + o.order_number + ' confirmed',
    htmlBody: shell(store, inner),
    name: store.store_name || 'Zemiki',
  });
  return json({ ok: true });
}

/* ------------------------------ tracking ----------------------------- */

function handleTracking(data) {
  var o = data.order, store = data.store || {};
  if (!o || !o.email) return json({ ok: false, error: 'no email' });

  var inner =
    '<h2 style="font-family:Georgia,serif;color:#5a1a2b;margin:0 0 4px">Your order is on its way!</h2>' +
    '<p style="color:#777;margin:0 0 18px">Order <strong>' + esc(o.order_number) + '</strong></p>' +
    '<p>Hi ' + esc(o.customer_name) + ', good news - your order has been shipped.</p>' +
    '<div style="margin:18px 0;padding:16px;background:#faf6ef;border:1px solid #eee;border-radius:10px;text-align:center">' +
    '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7a6f66">Tracking number</div>' +
    '<div style="font-size:22px;font-weight:bold;color:#5a1a2b;margin-top:4px">' + esc(o.tracking_id) + '</div></div>' +
    '<p style="color:#555">Delivery to:<br>' + esc(o.address || '') + '<br>' +
    esc(o.city || '') + (o.district ? ', ' + esc(o.district) : '') + '</p>' +
    (store.whatsapp_number ? '<p style="text-align:center;margin-top:20px"><a href="https://wa.me/' + esc(store.whatsapp_number) + '" style="background:#25d366;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">Any questions? Message us</a></p>' : '');

  MailApp.sendEmail({
    to: o.email,
    subject: (store.store_name || 'Zemiki') + ' - Order ' + o.order_number + ' has shipped',
    htmlBody: shell(store, inner),
    name: store.store_name || 'Zemiki',
  });
  return json({ ok: true });
}

/* ----------------------------- broadcast ----------------------------- */

function handleBroadcast(data) {
  var m = data.message || {}, store = data.store || {};
  var recipients = data.recipients || [];
  var banner = m.image_url ? '<img src="' + esc(m.image_url) + '" style="width:100%;border-radius:10px;margin-bottom:16px">' : '';
  var cta = (m.cta_url && m.cta_text)
    ? '<p style="text-align:center;margin-top:22px"><a href="' + esc(m.cta_url) + '" style="background:#5a1a2b;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;display:inline-block">' + esc(m.cta_text) + '</a></p>'
    : '';
  var inner =
    banner +
    (m.heading ? '<h2 style="font-family:Georgia,serif;color:#5a1a2b">' + esc(m.heading) + '</h2>' : '') +
    '<div style="font-size:15px;line-height:1.7;white-space:pre-wrap">' + esc(m.body) + '</div>' + cta;
  var html = shell(store, inner);

  var sent = 0;
  for (var i = 0; i < recipients.length; i++) {
    try {
      MailApp.sendEmail({
        to: recipients[i],
        subject: m.subject || 'News from ' + (store.store_name || 'Zemiki'),
        htmlBody: html,
        name: store.store_name || 'Zemiki',
      });
      sent++;
    } catch (err) { /* skip a bad address, keep going */ }
  }
  return json({ ok: true, sent: sent });
}
