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
 * Get table column info (name and type)
 */
async function getTableInfo(tableName) {
  try {
    const result = await db.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [tableName]
    );
    const columns = new Set();
    const types = new Map();
    
    for (const row of result.rows) {
      columns.add(row.column_name);
      types.set(row.column_name, row.data_type);
    }
    return { columns, types };
  } catch (err) {
    console.error(`Error getting columns for ${tableName}:`, err.message);
    return { columns: new Set(), types: new Map() };
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
 * Calculate age from DOB
 */
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

/**
 * Generate overall score for a player (0-100 scale)
 * Ensures At Risk players have scores that convert to < 5 component scores
 */
function generateOverallScore(playerIndex, quarterIndex) {
  const isAtRisk = AT_RISK_INDICES.includes(playerIndex);
  
  if (isAtRisk) {
    // At-risk: Low scores (below 45 ensure baseValue < 5)
    // 38 -> 3.8, 32 -> 3.2, 28 -> 2.8
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
    // Get schema info
    const playerSchema = await getTableInfo('players');
    const assessmentSchema = await getTableInfo('assessment_sessions');

    if (playerSchema.columns.size === 0 || assessmentSchema.columns.size === 0) {
      throw new Error('Database tables (players/assessment_sessions) missing or inaccessible.');
    }

    // Determine School ID based on column type
    // If UUID, use a static UUID. If Integer, use 1.
    const schoolIdType = playerSchema.types.get('school_id');
    const schoolId = (schoolIdType === 'uuid') 
      ? '00000000-0000-0000-0000-000000000001' 
      : 1;

    console.log(`[demo/reset] Using school_id: ${schoolId} (type: ${schoolIdType})`);

    await client.query('BEGIN');

    // Wipe existing data for this school
    await client.query('DELETE FROM assessment_sessions WHERE school_id = $1', [schoolId]);
    await client.query('DELETE FROM players WHERE school_id = $1', [schoolId]);

    const insertedPlayers = [];
    
    // Insert 15 dummy players
    for (let i = 0; i < DEMO_PLAYERS.length; i++) {
      const player = DEMO_PLAYERS[i];
      const payload = {
        name: player.name,
        school_id: schoolId,
        gender: player.gender,
        is_active: true
      };

      // Populate Required Fields
      setIfColumnExists(payload, playerSchema.columns, 'role', player.role);
      setIfColumnExists(payload, playerSchema.columns, 'std', '8');
      setIfColumnExists(payload, playerSchema.columns, 'div', 'A');
      setIfColumnExists(payload, playerSchema.columns, 'age', calculateAge(player.dob));
      setIfColumnExists(payload, playerSchema.columns, 'school_id_no', `SCH-${2026001 + i}`);
      setIfColumnExists(payload, playerSchema.columns, 'aadhaar_card_no', `9876-5432-${1000 + i}`);
      
      // Handle DOB/Date fields
      if (playerSchema.columns.has('date_of_birth')) {
        payload['date_of_birth'] = player.dob;
      } else if (playerSchema.columns.has('dob')) {
        payload['dob'] = player.dob;
      }

      // Fallbacks for std/div variations if schema differs
      setIfColumnExists(payload, playerSchema.columns, 'standard', '8');
      setIfColumnExists(payload, playerSchema.columns, 'division', 'A');

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
          school_id: schoolId,
          quarterly_cycle: quarter.label,
          test_date: quarter.testDate,
          overall_score: overall,
          improvement_pct: improvement,
          risk_status: overall < 60 ? 'At Risk' : 'On Track'
        };

        // Handle inconsistent naming (user_id vs player_id)
        setIfColumnExists(aPayload, assessmentSchema.columns, 'user_id', playerId);
        setIfColumnExists(aPayload, assessmentSchema.columns, 'player_id', playerId);

        // Component scores (Requirement 3: 4 players will have these < 5)
        setIfColumnExists(aPayload, assessmentSchema.columns, 'physical_score', components.physical);
        setIfColumnExists(aPayload, assessmentSchema.columns, 'skill_score', components.skill);
        setIfColumnExists(aPayload, assessmentSchema.columns, 'mental_score', components.mental);
        setIfColumnExists(aPayload, assessmentSchema.columns, 'coach_score', components.coach);

        // Feedback
        const feedback = overall < 60 
          ? 'Needs immediate attention and focused training.' 
          : 'Showing steady progress. Continue current drills.';
        setIfColumnExists(aPayload, assessmentSchema.columns, 'coach_feedback', feedback);

        // Detailed Skill Scores
        const skillBase = overall / 10;
        // Ensure keys match DB schema exactly
        setIfColumnExists(aPayload, assessmentSchema.columns, 'speed_score', Math.min(10, skillBase + 0.1));
        setIfColumnExists(aPayload, assessmentSchema.columns, 'agility_score', Math.min(10, skillBase - 0.1));
        setIfColumnExists(aPayload, assessmentSchema.columns, 'batting_score', skillBase + (player.role === 'Batsman' ? 0.5 : 0));
        setIfColumnExists(aPayload, assessmentSchema.columns, 'bowling_score', skillBase + (player.role === 'Bowler' ? 0.5 : 0));
        
        // Add other skill scores if they exist
        setIfColumnExists(aPayload, assessmentSchema.columns, 'endurance_score', Math.min(10, skillBase));
        setIfColumnExists(aPayload, assessmentSchema.columns, 'fielding_score', Math.min(10, skillBase + 0.2));
        setIfColumnExists(aPayload, assessmentSchema.columns, 'focus_score', Math.min(10, skillBase - 0.2));
        setIfColumnExists(aPayload, assessmentSchema.columns, 'discipline_score', Math.min(10, skillBase));
        setIfColumnExists(aPayload, assessmentSchema.columns, 'game_awareness_score', Math.min(10, skillBase));

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
        schoolIdType,
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
