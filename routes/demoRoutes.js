'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * 15 Demo players with roles for realistic data generation
 */
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

/**
 * Indices of players marked as "At Risk" (exactly 4 as requested)
 * Atharva, Kabir, Mihir, Myra
 */
const AT_RISK_INDICES = [4, 7, 9, 13];

/**
 * Quarter definitions for assessment history (3 quarters ensures graphs show lines)
 */
const QUARTERS = [
  { label: 'Q1 2026', testDate: '2026-01-15' },
  { label: 'Q2 2026', testDate: '2026-04-15' },
  { label: 'Q3 2026', testDate: '2026-07-15' }
];

/**
 * Get table columns to ensure compatibility with dynamic schema
 * (Avoids JOIN on schools table as requested)
 */
async function getColumns(tableName) {
  try {
    const result = await db.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [tableName]
    );
    return new Set(result.rows.map(row => row.column_name));
  } catch (err) {
    console.error(`Error getting columns for ${tableName}:`, err.message);
    return new Set();
  }
}

/**
 * Helper to safely set a field if it exists in the table
 */
function setIfColumnExists(payload, columns, key, value) {
  if (columns.has(key)) {
    payload[key] = value;
  }
}

/**
 * Build INSERT statement from payload
 */
function buildInsertSql(tableName, payload, returning = '*') {
  const keys = Object.keys(payload);
  if (keys.length === 0) {
    throw new Error(`Cannot insert empty payload into ${tableName}`);
  }
  const columns = keys.map(k => `"${k}"`).join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values = keys.map(k => payload[k]);
  return {
    sql: `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING ${returning}`,
    values
  };
}

/**
 * Generate overall score for a player (0-100 scale)
 * Ensures At Risk players have scores that convert to < 5 component scores
 */
function generateOverallScore(playerIndex, quarterIndex) {
  const isAtRisk = AT_RISK_INDICES.includes(playerIndex);
  
  if (isAtRisk) {
    // At-risk: Low scores (below 50 ensure baseValue < 5)
    // Decreasing trend to emphasize risk
    const atRiskScores = [38, 32, 28];
    return atRiskScores[quarterIndex];
  } else {
    // On-track: Solid scores (75+) with increasing trend
    const roleBase = {
      'Batsman': 78,
      'Bowler': 74,
      'All-Rounder': 76,
      'Wicketkeeper': 75
    };
    const player = DEMO_PLAYERS[playerIndex];
    const base = roleBase[player.role] || 75;
    return Math.min(92, base + (quarterIndex * 3));
  }
}

/**
 * Generate component scores (1-10 scale)
 * CRITICAL: For At Risk players, scores MUST be < 5.
 */
function generateComponentScores(overallScore) {
  // Normalize 0-100 to 1-10 scale
  const baseValue = overallScore / 10;
  
  // Variation within ±0.5 ensures that if overall < 45, all components < 5
  return {
    physical: Math.max(1, Math.min(10, Math.round(baseValue + 0.2))),
    skill: Math.max(1, Math.min(10, Math.round(baseValue + 0.4))),
    mental: Math.max(1, Math.min(10, Math.round(baseValue - 0.3))),
    coach: Math.max(1, Math.min(10, Math.round(baseValue + 0.1)))
  };
}

/**
 * POST /api/v1/demo/reset
 * Wipe and recreate demo data for school_id = 1
 */
router.post('/reset', authMiddleware, async (req, res) => {
  const client = await db.connect();
  
  try {
    // Requirement 2: Hardcode school_id = 1
    const schoolId = 1;

    // Requirement 1: No JOINs or queries to schools table. 
    // We get columns for players and assessment_sessions directly.
    const playerColumns = await getColumns('players');
    const assessmentColumns = await getColumns('assessment_sessions');

    if (playerColumns.size === 0 || assessmentColumns.size === 0) {
      throw new Error('Database tables (players/assessment_sessions) missing or inaccessible.');
    }

    const dobColumn = playerColumns.has('date_of_birth') ? 'date_of_birth'
                     : playerColumns.has('dob') ? 'dob'
                     : 'birth_date';

    await client.query('BEGIN');

    // Wipe existing data for this school
    await client.query('DELETE FROM assessment_sessions WHERE school_id = $1', [schoolId]);
    await client.query('DELETE FROM players WHERE school_id = $1', [schoolId]);

    const insertedPlayers = [];
    
    // Insert 15 dummy players
    for (const player of DEMO_PLAYERS) {
      const payload = {
        name: player.name,
        school_id: schoolId, // Hardcoded integer 1
        gender: player.gender,
        is_active: true
      };

      setIfColumnExists(payload, playerColumns, 'role', player.role);
      setIfColumnExists(payload, playerColumns, 'std', '8');
      setIfColumnExists(payload, playerColumns, 'standard', '8');
      setIfColumnExists(payload, playerColumns, 'div', 'A');
      setIfColumnExists(payload, playerColumns, 'division', 'A');
      
      if (playerColumns.has(dobColumn)) {
        payload[dobColumn] = player.dob;
      }

      const { sql, values } = buildInsertSql('players', payload, 'id, name');
      const result = await client.query(sql, values);
      insertedPlayers.push(result.rows[0]);
    }

    const playerMap = new Map(insertedPlayers.map(p => [p.name, p.id]));

    // Generate at least 3 assessments per player
    for (let pIdx = 0; pIdx < DEMO_PLAYERS.length; pIdx++) {
      const player = DEMO_PLAYERS[pIdx];
      const playerId = playerMap.get(player.name);
      
      let prevScore = null;

      for (let qIdx = 0; qIdx < QUARTERS.length; qIdx++) {
        const quarter = QUARTERS[qIdx];
        const overall = generateOverallScore(pIdx, qIdx);
        const components = generateComponentScores(overall);
        const improvement = prevScore === null ? 0 : Math.round(((overall - prevScore) / prevScore) * 100);

        const aPayload = {
          school_id: schoolId, // Hardcoded integer 1
          quarterly_cycle: quarter.label,
          test_date: quarter.testDate,
          overall_score: overall,
          improvement_pct: improvement,
          risk_status: overall < 60 ? 'At Risk' : 'On Track'
        };

        // Handle inconsistent naming (user_id vs player_id)
        setIfColumnExists(aPayload, assessmentColumns, 'user_id', playerId);
        setIfColumnExists(aPayload, assessmentColumns, 'player_id', playerId);

        // Component scores (Requirement 3: 4 players will have these < 5)
        setIfColumnExists(aPayload, assessmentColumns, 'physical_score', components.physical);
        setIfColumnExists(aPayload, assessmentColumns, 'skill_score', components.skill);
        setIfColumnExists(aPayload, assessmentColumns, 'mental_score', components.mental);
        setIfColumnExists(aPayload, assessmentColumns, 'coach_score', components.coach);

        // Feedback
        const feedback = overall < 60 
          ? 'Needs immediate attention and focused training.' 
          : 'Showing steady progress. Continue current drills.';
        setIfColumnExists(aPayload, assessmentColumns, 'coach_feedback', feedback);

        // Detailed Skill Scores
        const skillBase = overall / 10;
        setIfColumnExists(aPayload, assessmentColumns, 'speed_score', Math.min(10, skillBase + 0.1));
        setIfColumnExists(aPayload, assessmentColumns, 'agility_score', Math.min(10, skillBase - 0.1));
        setIfColumnExists(aPayload, assessmentColumns, 'batting_score', skillBase + (player.role === 'Batsman' ? 0.5 : 0));
        setIfColumnExists(aPayload, assessmentColumns, 'bowling_score', skillBase + (player.role === 'Bowler' ? 0.5 : 0));

        const { sql, values } = buildInsertSql('assessment_sessions', aPayload, 'id');
        await client.query(sql, values);
        
        prevScore = overall;
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Demo data reset successful',
      data: {
        schoolId,
        players: DEMO_PLAYERS.length,
        atRisk: AT_RISK_INDICES.length,
        assessmentsPerPlayer: QUARTERS.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[demo/reset] Failed:', error.message);
    res.status(500).json({ error: 'Reset failed', details: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
