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

/* brand palette */
var MAROON = '#5a1a2b';
var GOLD = '#c9a24b';
var GOLD_SOFT = '#e3c988';
var CREAM = '#faf6ef';
var INK = '#2b2320';
var MUTED = '#7a6f66';
var LINE = '#ece3d3';

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

function firstName(name) {
  return esc(String(name || 'there').split(' ')[0]);
}

/* A bulletproof, inline-styled anchor button. */
function button(label, url, bg, color) {
  bg = bg || MAROON; color = color || '#ffffff';
  return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 0"><tr>' +
    '<td style="border-radius:999px;background:' + bg + '">' +
    '<a href="' + esc(url) + '" style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:' + color + ';text-decoration:none;border-radius:999px">' + esc(label) + '</a>' +
    '</td></tr></table>';
}

function eyebrow(text) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:' + GOLD + ';font-weight:bold">' + esc(text) + '</div>';
}

/* Outer shell: header band + white card + footer, on a soft background. */
function shell(store, inner) {
  var name = esc(store.store_name || 'Zemiki');
  var header = LOGO_URL
    ? '<tr><td align="center" style="background:#ffffff;padding:22px 24px;border-bottom:3px solid ' + GOLD + '">' +
        '<img src="' + LOGO_URL + '" alt="' + name + '" style="height:52px;display:block;margin:auto">' +
      '</td></tr>'
    : '<tr><td align="center" style="background:' + MAROON + ';padding:26px 24px;border-bottom:3px solid ' + GOLD + '">' +
        '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:28px;font-weight:bold;color:#ffffff;letter-spacing:1px">' + name + '</div>' +
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:' + GOLD_SOFT + ';margin-top:4px">Handcrafted Jewelry</div>' +
      '</td></tr>';

  return '' +
    '<div style="background:#efe9df;padding:26px 12px;margin:0">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" ' +
      'style="max-width:600px;width:100%;margin:auto;background:#ffffff;border:1px solid ' + LINE + ';border-radius:16px;overflow:hidden">' +
    header +
    '<tr><td style="padding:30px 30px 26px;font-family:Arial,Helvetica,sans-serif;color:' + INK + '">' + inner + '</td></tr>' +
    '<tr><td style="background:' + CREAM + ';border-top:1px solid ' + LINE + ';padding:20px;text-align:center;' +
      'font-family:Arial,Helvetica,sans-serif;font-size:12px;color:' + MUTED + '">' +
      '&copy; ' + new Date().getFullYear() + ' ' + name + '<br>Crafted with love in Sri Lanka' +
      (store.whatsapp_number ? '<br><a href="https://wa.me/' + esc(store.whatsapp_number) + '" style="color:' + MAROON + ';text-decoration:none">Message us on WhatsApp</a>' : '') +
    '</td></tr>' +
    '</table></div>';
}

/* ------------------------------ invoice ------------------------------ */

function handleInvoice(data) {
  var o = data.order, store = data.store || {};
  if (!o || !o.email) return json({ ok: false, error: 'no email' });

  var rows = (o.items || []).map(function (i, idx) {
    var bg = idx % 2 ? '#ffffff' : CREAM;
    return '<tr>' +
      '<td style="padding:11px 14px;font-size:14px;background:' + bg + '">' + esc(i.name) + '</td>' +
      '<td style="padding:11px 8px;font-size:14px;text-align:center;color:' + MUTED + ';background:' + bg + '">x' + i.qty + '</td>' +
      '<td style="padding:11px 14px;font-size:14px;text-align:right;font-weight:bold;background:' + bg + '">' + money(i.unit_price * i.qty) + '</td>' +
      '</tr>';
  }).join('');

  var gift = o.is_gift
    ? '<div style="background:#fff8ec;border:1px dashed ' + GOLD + ';border-radius:10px;padding:12px 16px;font-size:14px;margin:0 0 18px">' +
        '&#127873; This order is being sent as a gift, so prices are hidden on the delivery note.</div>'
    : '';

  var totals =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">' +
    '<tr><td style="padding:5px 14px;font-size:14px;color:' + MUTED + '">Subtotal</td>' +
      '<td style="padding:5px 14px;font-size:14px;text-align:right">' + money(o.subtotal) + '</td></tr>' +
    '<tr><td style="padding:5px 14px;font-size:14px;color:' + MUTED + '">Shipping</td>' +
      '<td style="padding:5px 14px;font-size:14px;text-align:right">' + money(o.shipping) + '</td></tr>' +
    '<tr><td style="padding:12px 14px 0;font-size:17px;font-weight:bold;color:' + MAROON + ';border-top:2px solid ' + INK + '">Total</td>' +
      '<td style="padding:12px 14px 0;font-size:17px;font-weight:bold;text-align:right;color:' + MAROON + ';border-top:2px solid ' + INK + '">' + money(o.total) + '</td></tr>' +
    '</table>';

  var inner =
    eyebrow('Order confirmed') +
    '<h1 style="font-family:Georgia,serif;color:' + MAROON + ';font-size:26px;margin:6px 0 4px">Thank you, ' + firstName(o.customer_name) + '!</h1>' +
    '<p style="font-size:15px;color:' + MUTED + ';margin:0 0 20px">We have received your order ' +
      '<strong style="color:' + INK + '">' + esc(o.order_number) + '</strong>. Here is your summary.</p>' +
    gift +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ' + LINE + ';border-radius:12px;overflow:hidden">' +
      '<tr><th align="left" style="background:' + MAROON + ';color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase;padding:10px 14px">Item</th>' +
      '<th style="background:' + MAROON + ';color:#fff;font-size:11px;padding:10px 8px">Qty</th>' +
      '<th align="right" style="background:' + MAROON + ';color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase;padding:10px 14px">Total</th></tr>' +
      rows +
    '</table>' +
    totals +
    '<div style="margin-top:22px;padding:16px 18px;background:' + CREAM + ';border-radius:12px;font-size:14px;line-height:1.6">' +
      '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + MUTED + ';margin-bottom:6px">Delivery to</div>' +
      '<strong>' + esc(o.customer_name) + '</strong><br>' + esc(o.address || '') + '<br>' +
      esc(o.city || '') + (o.district ? ', ' + esc(o.district) : '') + '<br>' + esc(o.phone) +
      '<div style="margin-top:8px;color:' + MUTED + '">Payment: ' + esc(o.payment_method) + ' (' + esc(o.payment_status) + ')</div>' +
    '</div>' +
    '<p style="font-size:13px;color:' + MUTED + ';text-align:center;margin:18px 0 0">We will email you the tracking details as soon as your order ships.</p>' +
    (store.whatsapp_number ? button('Message us on WhatsApp', 'https://wa.me/' + store.whatsapp_number, '#25d366', '#083a1e') : '');

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
    eyebrow('On its way') +
    '<h1 style="font-family:Georgia,serif;color:' + MAROON + ';font-size:26px;margin:6px 0 4px">Your order has shipped!</h1>' +
    '<p style="font-size:15px;color:' + MUTED + ';margin:0 0 20px">Hi ' + firstName(o.customer_name) + ', great news - order ' +
      '<strong style="color:' + INK + '">' + esc(o.order_number) + '</strong> is on the way to you.</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
      '<tr><td align="center" style="background:' + CREAM + ';border:2px solid ' + GOLD + ';border-radius:14px;padding:22px">' +
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:' + MUTED + '">Tracking number</div>' +
        '<div style="font-family:Georgia,serif;font-size:26px;font-weight:bold;color:' + MAROON + ';margin-top:6px;letter-spacing:1px">' + esc(o.tracking_id) + '</div>' +
      '</td></tr>' +
    '</table>' +
    '<div style="margin-top:20px;padding:16px 18px;background:#ffffff;border:1px solid ' + LINE + ';border-radius:12px;font-size:14px;line-height:1.6">' +
      '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + MUTED + ';margin-bottom:6px">Shipping to</div>' +
      esc(o.address || '') + '<br>' + esc(o.city || '') + (o.district ? ', ' + esc(o.district) : '') +
    '</div>' +
    (store.whatsapp_number ? button('Any questions? Message us', 'https://wa.me/' + store.whatsapp_number, '#25d366', '#083a1e') : '');

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
  var banner = m.image_url
    ? '<img src="' + esc(m.image_url) + '" alt="" style="width:100%;border-radius:12px;margin-bottom:18px;display:block">'
    : '';
  var cta = (m.cta_url && m.cta_text) ? button(m.cta_text, m.cta_url, MAROON, '#ffffff') : '';
  var inner =
    banner +
    (m.heading ? eyebrow(store.store_name || 'Zemiki') +
      '<h1 style="font-family:Georgia,serif;color:' + MAROON + ';font-size:26px;margin:6px 0 14px">' + esc(m.heading) + '</h1>' : '') +
    '<div style="font-size:15px;line-height:1.7;color:' + INK + ';white-space:pre-wrap">' + esc(m.body) + '</div>' +
    cta;
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
