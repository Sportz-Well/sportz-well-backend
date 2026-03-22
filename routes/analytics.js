'use strict';

const express = require('express');
const router = express.Router();

// TEMP SAFE ROUTES (to prevent crash)

router.get('/dashboard', (req, res) => {
  res.json({ success: true, message: 'Dashboard working' });
});

router.get('/trend', (req, res) => {
  res.json({ success: true, message: 'Trend working' });
});

module.exports = router;