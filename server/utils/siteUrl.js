'use strict';

/** Public base URL of the store (no trailing slash). PUBLIC_BASE_URL wins. */
function siteUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${req.get('host')}`;
}

function trackUrl(req, token) {
  return token ? `${siteUrl(req)}/track/${token}` : '';
}

module.exports = { siteUrl, trackUrl };
