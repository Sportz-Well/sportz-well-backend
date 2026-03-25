'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const DEMO_PLAYERS = [
  { name: 'Aarav Sharma', role: 'Batsman', gender: 'Male', dob: '2012-04-12' },
  { name: 'Aditya Nair', role: 'All-Rounder', gender: 'Male', dob: '2012-08-25' },
  { name: 'Arjun Patel', role: 'Batsman', gender: 'Male', dob: '2011-11-09' },
  { name: 'Aryan Gupta', role: 'Batsman', gender: 'Male', dob: '2012-01-30' },
  { name: 'Atharva Kulkarni', role: 'Bowler', gender: 'Male', dob: '2011-07-17' },
  { name: 'Dhruv Verma', role: 'Wicketkeeper', gender: 'Male', dob: '2012-05-03' },
  { name: 'Harsh Vardhan', role: 'Batsman', gender: 'Male', dob: '2011-12-15' },
  { name: 'Kabir Singh', role: 'Bowler', gender: 'Male', dob: '2012-02-21' },
  { name: 'Krish Shah', role: 'All-Rounder', gender: 'Male', dob: '2011-10-14' },
  { name: 'Mihir Deshmukh', role: 'Bowler', gender: 'Male', dob: '2012-09-11' },
  { name: 'Anaya Desai', role: 'Batsman', gender: 'Female', dob: '2012-03-06' },
  { name: 'Diya Menon', role: 'Wicketkeeper', gender: 'Female', dob: '2011-06-20' },
  { name: 'Ira Joshi', role: 'All-Rounder', gender: 'Female', dob: '2012-10-09' },
  { name: 'Myra Kulkarni', role: 'Bowler', gender: 'Female', dob: '2011-09-27' },
  { name: 'Rohan Patil', role: 'Batsman', gender: 'Male', dob: '2012-12-01' }
];

const AT_RISK_INDICES = [4, 7, 9, 13]; // Atharva, Kabir, Mihir, Myra

const QUARTERS = [
  { label: 'Q1 2026', testDate: '2026-01-15' },
  { label: 'Q2 2026', testDate: '2026-04-15' },
  { label: 'Q3 2026', testDate: '2026-07-15' }
];

function calculateAge(dobString) {
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function generateScores(isAtRisk, quarterIndex) {
  if (isAtRisk) {
    // Component scores must be below 5
    // Overall scores between 20-40 usually result in component scores < 5
    const scores = [35, 30, 25];
    const val = scores[quarterIndex];
    return {
      overall: val,
      physical: Math.round(val / 10 + 0.1), // ~3.6, ~3.1, ~2.6
      skill: Math.round(val / 10 + 0.2),
      mental: Math.round(val / 10 - 0.2),
      coach: Math.round(val / 10 + 0.1)
    };
  } else {
    const base = 78 + (quarterIndex * 2);
    const val = Math.min(90, base);
    return {
      overall: val,
      physical: Math.round(val / 10 + 0.5),
      skill: Math.round(val / 10 + 0.3),
      mental: Math.round(val / 10 - 0.2),
      coach: Math.round(val / 10 + 0.4)
    };
  }
}

/**
 * GOD MODE SCHEMA SYNC
 * Ensures all tables and columns exist before insertion
 */
async function godModeSchemaSync(client) {
  console.log('[GodMode] Starting Schema Sync...');

  // 1. Ensure UUID Extension
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // 2. PLAYERS TABLE
  await client.query(`
    CREATE TABLE IF NOT EXISTS players (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Ensure all columns exist for players
  const playerColumns = [
    'name VARCHAR(255)',
    'role VARCHAR(50)',
    'gender VARCHAR(50)',
    'dob DATE', // Date of Birth
    'age INTEGER',
    'std VARCHAR(50)',
    'div VARCHAR(50)',
    'school_id INTEGER DEFAULT 1',
    'is_active BOOLEAN DEFAULT true',
    'school_id_no VARCHAR(100)',
    'aadhaar_card_no VARCHAR(100)'
  ];

  for (const colDef of playerColumns) {
    // Extract column name (first word)
    const colName = colDef.split(' ')[0];
    await client.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS ${colDef};`);
  }

  // 3. ASSESSMENT SESSIONS TABLE
  await client.query(`
    CREATE TABLE IF NOT EXISTS assessment_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure all columns exist for assessment_sessions
  const assessmentColumns = [
    'user_id UUID',
    'school_id INTEGER DEFAULT 1',
    'quarterly_cycle VARCHAR(50)',
    'test_date DATE',
    'overall_score NUMERIC',
    'improvement_pct NUMERIC',
    'risk_status VARCHAR(50)',
    'physical_score INTEGER',
    'skill_score INTEGER',
    'mental_score INTEGER',
    'coach_score INTEGER',
    'coach_feedback TEXT',
    // Detailed skill scores
    'speed_score NUMERIC',
    'agility_score NUMERIC',
    'batting_score NUMERIC',
    'bowling_score NUMERIC',
    'endurance_score NUMERIC',
    'fielding_score NUMERIC',
    'focus_score NUMERIC',
    'discipline_score NUMERIC',
    'game_awareness_score NUMERIC'
  ];

  for (const colDef of assessmentColumns) {
    await client.query(`ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS ${colDef};`);
  }

  console.log('[GodMode] Schema Sync Complete.');
}

router.post('/reset', authMiddleware, async (req, res) => {
  const client = await db.connect();
  
  try {
    const schoolId = 1;
    await client.query('BEGIN');

    // 🔥 RUN GOD MODE SYNC
    await godModeSchemaSync(client);

    // Wipe old demo data
    await client.query('DELETE FROM assessment_sessions WHERE school_id = $1', [schoolId]);
    await client.query('DELETE FROM players WHERE school_id = $1', [schoolId]);

    for (let i = 0; i < DEMO_PLAYERS.length; i++) {
      const p = DEMO_PLAYERS[i];
      const age = calculateAge(p.dob);
      const schoolIdNo = `SID-${1000 + i}`;
      const aadhaarNo = `A-5678-${2000 + i}`;

      // INSERT Player with all requested columns
      const playerRes = await client.query(
        `INSERT INTO players (name, role, gender, dob, age, std, div, school_id, is_active, school_id_no, aadhaar_card_no) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [p.name, p.role, p.gender, p.dob, age, '8', 'A', schoolId, true, schoolIdNo, aadhaarNo]
      );
      const playerId = playerRes.rows[0].id; // This UUID is the foreign key for assessments

      // INSERT 3 Assessments per player
      const isAtRisk = AT_RISK_INDICES.includes(i);
      let prevScore = null;

      for (let q = 0; q < QUARTERS.length; q++) {
        const quarter = QUARTERS[q];
        const scores = generateScores(isAtRisk, q);
        const improvement = prevScore === null ? 0 : Math.round(((scores.overall - prevScore) / prevScore) * 100);

        // LINKING: user_id = playerId (UUID from players table)
        await client.query(
          `INSERT INTO assessment_sessions 
           (user_id, school_id, quarterly_cycle, test_date, overall_score, improvement_pct, risk_status, 
            physical_score, skill_score, mental_score, coach_score, coach_feedback)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            playerId, 
            schoolId, 
            quarter.label, 
            quarter.testDate, 
            scores.overall, 
            improvement, 
            scores.overall < 60 ? 'At Risk' : 'On Track',
            scores.physical, 
            scores.skill, 
            scores.mental, 
            scores.coach,
            scores.overall < 60 ? 'Needs immediate attention and focused training.' : 'Showing steady progress. Continue current drills.'
          ]
        );
        prevScore = scores.overall;
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Demo reset successful with God Mode sync.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[demo/reset] Error:', error.message);
    res.status(500).json({ error: 'Reset failed', details: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
