'use strict';

/**
 * Lightweight security hardening with no extra dependencies:
 *  - sensible security response headers (+ a compatible CSP)
 *  - a simple in-memory fixed-window rate limiter
 */

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  // Content Security Policy - permissive enough for the site's inline handlers,
  // Google Fonts, remote product images, and the payment-gateway form posts.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "form-action 'self' https:",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
    ].join('; ')
  );
  next();
}

/**
 * Fixed-window rate limiter.
 * @param {{windowMs:number, max:number, message?:string}} opts
 */
function rateLimit(opts) {
  const windowMs = opts.windowMs || 60000;
  const max = opts.max || 60;
  const message = opts.message || 'Too many requests, please slow down.';
  const hits = new Map(); // key -> { count, resetAt }

  // periodic cleanup so the map doesn't grow unbounded
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs).unref();

  return function (req, res, next) {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
    const key = ip + ':' + req.baseUrl + req.path;
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs };
      hits.set(key, rec);
    }
    rec.count += 1;
    if (rec.count > max) {
      res.setHeader('Retry-After', Math.ceil((rec.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

module.exports = { securityHeaders, rateLimit };
