'use strict';

const express = require('express');
const router = express.Router();

// 🚨 TEMP HARDCODE LOGIN (BYPASS DB)

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (
    email === 'admin@sportzwell.com' &&
    password === 'admin123'
  ) {
    return res.json({
      success: true,
      token: 'demo-token',
      user: { email }
    });
  }

  return res.status(401).json({
    error: 'Invalid credentials'
  });
});

module.exports = router;