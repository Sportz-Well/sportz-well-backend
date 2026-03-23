'use strict';

const express = require('express');
const router = express.Router();

// 🔥 DISABLED RESET (FOR DEMO STABILITY)
router.get('/clean', async (req, res) => {
  res.json({
    success: true,
    message: 'Reset disabled for demo'
  });
});

router.post('/clean', async (req, res) => {
  res.json({
    success: true,
    message: 'Reset disabled for demo'
  });
});

module.exports = router;