'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret';
const COOKIE_NAME = 'zemiki_admin';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

/**
 * Express middleware guarding admin API routes. Reads the JWT from the
 * cookie (or Authorization: Bearer header) and rejects unauthenticated
 * requests with 401.
 */
function requireAdmin(req, res, next) {
  const fromCookie = req.cookies && req.cookies[COOKIE_NAME];
  const header = req.headers.authorization || '';
  const fromHeader = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = fromCookie || fromHeader;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAdmin,
  COOKIE_NAME,
};
