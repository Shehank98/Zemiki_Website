'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

/**
 * POST /api/enquiries - contact form / WhatsApp fallback message.
 * body: { name, phone, email, message, product_id }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, phone, email, message, product_id } = req.body || {};
    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required' });
    }
    await query(
      `INSERT INTO enquiries (name, phone, email, message, product_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [name, phone || null, email || null, message, product_id ? parseInt(product_id, 10) : null]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
