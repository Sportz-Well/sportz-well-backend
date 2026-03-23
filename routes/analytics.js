'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/dashboard', async (req, res) => {
  try {
    const totalPlayers = await db.query(`SELECT COUNT(*) FROM players`);

    const avgScore = await db.query(
      `SELECT ROUND(AVG(overall_score),2) as avg FROM assessment_sessions`
    );

    res.json({
      success: true,
      total_players: Number(totalPlayers.rows[0].count),
      avg_score: avgScore.rows[0].avg || 0
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/trend', async (req, res) => {
  try {
    const data = await db.query(`
      SELECT quarterly_cycle, ROUND(AVG(overall_score),2) as avg_score
      FROM assessment_sessions
      GROUP BY quarterly_cycle
      ORDER BY quarterly_cycle
    `);

    res.json({
      success: true,
      data: data.rows
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;