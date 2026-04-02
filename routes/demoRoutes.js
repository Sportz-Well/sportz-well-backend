'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../db');

// =========================================================
// CTO RIGGED DEMO SCRIPT: Mathematically Perfect Data Seed (1-10 Scale)
// =========================================================
router.post('/reset', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // =========================================================
    // CTO FIX: The "God Mode" Schema Auto-Healer
    // Guarantee all columns exist before we insert data!
    // =========================================================
    await client.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS latest_score DECIMAL(5,1),
      ADD COLUMN IF NOT EXISTS coach_signal VARCHAR(50),
      ADD COLUMN IF NOT EXISTS school_id INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS school_id_no VARCHAR(100),
      ADD COLUMN IF NOT EXISTS aadhaar_card_no VARCHAR(100),
      ADD COLUMN IF NOT EXISTS role VARCHAR(50),
      ADD COLUMN IF NOT EXISTS gender VARCHAR(50),
      ADD COLUMN IF NOT EXISTS std VARCHAR(50),
      ADD COLUMN IF NOT EXISTS div VARCHAR(50),
      ADD COLUMN IF NOT EXISTS age INTEGER,
      ADD COLUMN IF NOT EXISTS dob DATE;
    `);

    // 1. Nuke all existing data to prevent duplicates
    await client.query('TRUNCATE TABLE assessment_sessions CASCADE');
    await client.query('TRUNCATE TABLE players CASCADE');

    // 2. Define the 15 Cast Members
    const demoPlayers = [
      { name: 'Aarav Sharma', role: 'Batsman', gender: 'Male', type: 'top' },
      { name: 'Aditya Nair', role: 'All-Rounder', gender: 'Male', type: 'risk' },
      { name: 'Anaya Desai', role: 'Batsman', gender: 'Female', type: 'risk' },
      { name: 'Kabir Singh', role: 'Bowler', gender: 'Male', type: 'risk' },
      { name: 'Diya Patel', role: 'Wicketkeeper', gender: 'Female', type: 'risk' },
      { name: 'Rohan Mehta', role: 'Batsman', gender: 'Male', type: 'stable' },
      { name: 'Isha Joshi', role: 'Bowler', gender: 'Female', type: 'stable' },
      { name: 'Vivaan Reddy', role: 'All-Rounder', gender: 'Male', type: 'stable' },
      { name: 'Tara Iyer', role: 'Batsman', gender: 'Female', type: 'stable' },
      { name: 'Arjun Rao', role: 'Bowler', gender: 'Male', type: 'stable' },
      { name: 'Mira Kapoor', role: 'All-Rounder', gender: 'Female', type: 'stable' },
      { name: 'Aryan Das', role: 'Batsman', gender: 'Male', type: 'stable' },
      { name: 'Riya Choudhury', role: 'Bowler', gender: 'Female', type: 'stable' },
      { name: 'Karan Verma', role: 'Wicketkeeper', gender: 'Male', type: 'stable' },
      { name: 'Neha Gupta', role: 'Batsman', gender: 'Female', type: 'stable' }
    ];

    const quarters = ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'];

    // 3. Loop through and rig the math (Strictly 1-10 Scale)
    for (let i = 0; i < demoPlayers.length; i++) {
      const p = demoPlayers[i];

      // Determine the mathematical fate of the player
      let baseScore, finalScore, signal;
      
      if (p.type === 'top') {
         baseScore = 8.8; finalScore = 9.4; signal = 'Excellent';
      } else if (p.type === 'risk') {
         baseScore = 6.0; finalScore = 4.2; signal = 'At Risk';
      } else {
         baseScore = 6.0; finalScore = 6.5; signal = 'Stable';
      }

      // Insert Player and stamp their final score directly onto the master profile
      const playerRes = await client.query(`
        INSERT INTO players 
        (name, dob, age, std, div, school_id_no, aadhaar_card_no, role, gender, latest_score, coach_signal, school_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1)
        RETURNING id
      `, [
        p.name, '2012-05-15', 13, '8', 'A', `SID-100${i}`, `A-5678-200${i}`, p.role, p.gender, finalScore, signal
      ]);

      const playerId = playerRes.rows[0].id;

      // Generate 4 Historical Quarters to draw the trend lines
      for (let q = 0; q < quarters.length; q++) {
         let qScore = baseScore;
         
         // Create realistic trend lines on a 1-10 scale
         if (p.type === 'top') qScore = baseScore + (q * 0.2); // Climbs from 8.8 to 9.4
         if (p.type === 'risk') qScore = baseScore - (q * 0.6); // Plummets from 6.0 to 4.2
         if (p.type === 'stable') qScore = baseScore + (q * 0.16); // Climbs slowly from 6.0 to 6.48

         await client.query(`
           INSERT INTO assessment_sessions 
           (user_id, school_id, physical_score, skill_score, mental_score, coach_score, overall_score, quarterly_cycle)
           VALUES ($1, 1, $2, $2, $2, $2, $3, $4)
         `, [playerId, qScore.toFixed(1), qScore.toFixed(1), quarters[q]]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Rigged demo data generated perfectly on 1-10 scale.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Demo Reset Error:", err);
    res.status(500).json({ error: 'Failed to reset demo data', details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;