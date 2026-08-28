'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/categories - public list with product counts
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.name, c.slug, c.image_url, c.sort_order,
              COUNT(p.id) FILTER (WHERE p.active) AS product_count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id
        ORDER BY c.sort_order, c.name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
