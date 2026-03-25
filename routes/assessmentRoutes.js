'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

// 🔥 SAVE NEW ASSESSMENT
router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      school_id,
      test_date,
      quarterly_cycle,
      overall_score,
      physical_score,
      skill_score,
      mental_score,
      coach_score,
      coach_feedback,
      risk_status,
      // Detailed scores (optional but good to have)
      speed_score,
      agility_score,
      batting_score,
      bowling_score,
      endurance_score,
      fielding_score,
      focus_score,
      discipline_score,
      game_awareness_score
    } = req.body;

    if (!user_id || !school_id || !test_date) {
      return res.status(400).json({ error: 'Missing required fields (user_id, school_id, test_date)' });
    }

    // Insert into DB
    const result = await db.query(
      `INSERT INTO assessment_sessions (
        user_id, school_id, test_date, quarterly_cycle, overall_score, risk_status,
        physical_score, skill_score, mental_score, coach_score, coach_feedback,
        speed_score, agility_score, batting_score, bowling_score, endurance_score,
        fielding_score, focus_score, discipline_score, game_awareness_score
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 
        $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING id`,
      [
        user_id,
        school_id,
        test_date,
        quarterly_cycle || 'Q1',
        overall_score || 0,
        risk_status || 'On Track',
        physical_score || 0,
        skill_score || 0,
        mental_score || 0,
        coach_score || 0,
        coach_feedback || '',
        speed_score || 0,
        agility_score || 0,
        batting_score || 0,
        bowling_score || 0,
        endurance_score || 0,
        fielding_score || 0,
        focus_score || 0,
        discipline_score || 0,
        game_awareness_score || 0
      ]
    );

    res.json({
      success: true,
      message: "Assessment saved successfully",
      assessmentId: result.rows[0].id
    });

  } catch (error) {
    console.error('[assessments] Error saving assessment:', error.message);
    res.status(500).json({ error: 'Failed to save assessment', details: error.message });
  }
});

// 🔥 GET HISTORY FOR A PLAYER (Optional helper)
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await db.query(
      `SELECT * FROM assessment_sessions WHERE user_id = $1 ORDER BY test_date ASC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[assessments] Error fetching history:', error.message);
    res.status(500).json({ error: 'Failed to fetch assessment history' });
  }
});

module.exports = router;
