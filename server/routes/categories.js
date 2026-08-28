'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/categories - public list with product counts
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.name, c.slug, c.sort_order,
              COUNT(p.id) FILTER (WHERE p.active) AS product_count,
              COALESCE(
                c.image_url,
                (SELECT pi.url
                   FROM product_images pi
                   JOIN products p2 ON p2.id = pi.product_id
                  WHERE p2.category_id = c.id AND p2.active = true
                  ORDER BY p2.featured DESC, pi.sort_order, pi.id
                  LIMIT 1)
              ) AS image_url
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
