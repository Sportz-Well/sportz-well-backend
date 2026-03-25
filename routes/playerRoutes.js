'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

// 🔥 GET ALL PLAYERS (Filtered by School ID)
router.get('/', async (req, res) => {
  try {
    const schoolId = 1; // Default for demo context
    
    // Ensure school_id matches the demo reset logic (integer 1)
    const result = await db.query(
      `SELECT * FROM players WHERE school_id = $1 ORDER BY name ASC`, 
      [schoolId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[playerRoutes] Error fetching players:', error.message);
    // Return empty array to prevent frontend crash
    res.json([]);
  }
});

// 🔥 GET SINGLE PLAYER
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM players WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(`[playerRoutes] Error fetching player ${req.params.id}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch player details' });
  }
});

// 🔥 QUARTERLY TREND (Player Specific)
router.get('/:id/quarterly-trend', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT quarterly_cycle as label, overall_score as score, test_date 
       FROM assessment_sessions 
       WHERE user_id = $1 
       ORDER BY test_date ASC`,
      [id]
    );

    res.json(result.rows.map(row => ({
      label: row.label || (row.test_date ? new Date(row.test_date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : 'N/A'),
      avg_score: Math.round(Number(row.score || 0))
    })));
  } catch (error) {
    console.error(`[player-trend-q] Error for player ${req.params.id}:`, error.message);
    res.json([]);
  }
});

// 🔥 ADD PLAYER (Keep simple for now, can be expanded later)
router.post('/', async (req, res) => {
  try {
    // This is a placeholder for actual player creation logic
    // For now, we just return a success message
    res.json({
      message: "Player added successfully (Mock)"
    });
  } catch (error) {
    console.error('[playerRoutes] Error adding player:', error.message);
    res.status(500).json({ error: 'Failed to add player' });
  }
});

module.exports = router;
