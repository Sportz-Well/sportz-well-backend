'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

// DASHBOARD API (SINGLE SCHOOL MODE)
router.get('/dashboard', async (req, res) => {
  try {
    const schoolId = 1;

    const totalPlayers = await db.query(
      `SELECT COUNT(*) FROM players WHERE school_id = $1`,
      [schoolId]
    );

    const avgScore = await db.query(
      `SELECT ROUND(AVG(overall_score),2) as avg FROM assessment_sessions WHERE school_id = $1`,
      [schoolId]
    );

    const latestScore = await db.query(`
      SELECT overall_score
      FROM assessment_sessions
      ORDER BY test_date DESC
      LIMIT 1
    `);

    const atRisk = await db.query(`
      SELECT COUNT(*) 
      FROM assessment_sessions 
      WHERE overall_score < 65 AND school_id = $1
    `, [schoolId]);

    res.json({
      success: true,
      data: {
        total_players: Number(totalPlayers.rows[0].count),
        avg_score: avgScore.rows[0].avg || 0,
        latest_score: latestScore.rows[0]?.overall_score || 0,
        at_risk: Number(atRisk.rows[0].count)
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;