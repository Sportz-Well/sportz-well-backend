'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db'); // Connecting to your real database

// ==========================================
// CTO SECURITY: TENANT EXTRACTION MIDDLEWARE
// ==========================================
const extractTenant = (req, res, next) => {
  const authHeader = req.headers.authorization;
  let academyId = 'DEMO_ACADEMY'; // Safe fallback
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token.startsWith('swpi-token-')) {
      academyId = token.replace('swpi-token-', '');
    }
  }
  
  req.academyId = academyId;
  next();
};

router.use(extractTenant);

// 🔥 GET ALL ASSESSMENTS (Secured by Academy)
router.get('/', async (req, res) => {
  try {
    let result;
    if (req.academyId === 'ALL') {
      result = await db.query('SELECT * FROM assessment_sessions ORDER BY test_date DESC');
    } else {
      result = await db.query('SELECT * FROM assessment_sessions WHERE academy_id = $1 ORDER BY test_date DESC', [req.academyId]);
    }
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[assessmentRoutes] Error fetching assessments:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 🔥 SUBMIT ASSESSMENT (Secured & Locked to Academy)
router.post('/', async (req, res) => {
  try {
    const { player_id, quarter, physical_score, skill_score, mental_score, coach_score } = req.body;
    
    // Admin saves default to Demo Academy to prevent database cross-contamination
    const targetAcademy = req.academyId === 'ALL' ? 'DEMO_ACADEMY' : req.academyId;

    // Calculate the overall score dynamically
    const physical = Number(physical_score) || 0;
    const skill = Number(skill_score) || 0;
    const mental = Number(mental_score) || 0;
    const coach = Number(coach_score) || 0;
    const overall = ((physical + skill + mental + coach) / 4).toFixed(1);

    // 1. Insert the new assessment into the timeline
    await db.query(
      `INSERT INTO assessment_sessions 
      (user_id, quarterly_cycle, physical_score, skill_score, mental_score, coach_score, overall_score, academy_id, test_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [player_id, quarter, physical, skill, mental, coach, overall, targetAcademy]
    );

    // 2. Automatically update the player's Master Score on their profile
    await db.query(
      `UPDATE players SET latest_score = $1 WHERE id = $2 AND academy_id = $3`,
      [overall, player_id, targetAcademy]
    );

    res.json({
      success: true,
      message: "Assessment saved securely to official database"
    });
  } catch (error) {
    console.error('[assessmentRoutes] Error saving assessment:', error.message);
    res.status(500).json({ success: false, message: 'Failed to save assessment' });
  }
});

module.exports = router;