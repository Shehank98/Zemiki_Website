'use strict';

const express = require('express');
const { getDistricts } = require('../settings');

const router = express.Router();

// GET /api/shipping/districts - active districts + their fees for checkout
router.get('/districts', async (req, res, next) => {
  try {
    res.json(await getDistricts());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
