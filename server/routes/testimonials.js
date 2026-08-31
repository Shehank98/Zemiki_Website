'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/testimonials - active testimonials for the storefront.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, location, rating, quote FROM testimonials WHERE active = true ORDER BY sort_order, id'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
