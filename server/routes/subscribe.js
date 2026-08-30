'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/subscribe  body: { email }
router.post('/', async (req, res, next) => {
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email' });
    }
    await query(
      'INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
      [email]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
