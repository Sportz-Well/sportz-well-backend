'use strict';

const express = require('express');
const router = express.Router();

// 🔥 TEST ROUTE (keep it)
router.get('/test', (req, res) => {
  res.json({
    message: 'NEW CODE DEPLOYED SUCCESSFULLY'
  });
});

// 🔥 DASHBOARD (NO DB DEPENDENCY)
router.get('/dashboard', async (req, res) => {
  res.json({
    success: true,
    total_players: 10,
    avg_score: 74,
    latest_score: 83,
    at_risk: 2
  });
});

// 🔥 TREND (NO DB DEPENDENCY)
router.get('/trend', async (req, res) => {
  res.json({
    success: true,
    data: [
      { label: 'Q1', avg_score: 64 },
      { label: 'Q2', avg_score: 74 },
      { label: 'Q3', avg_score: 83 }
    ]
  });
});

module.exports = router;