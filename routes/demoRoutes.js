'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// Demo players data with roles for score generation
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

// Indices of players marked as "At Risk" (must be exactly 4)
const AT_RISK_INDICES = [4, 7, 9, 13]; // Atharva, Kabir, Mihir, Myra

// Quarter definitions for assessment history
const QUARTERS = [
  { label: 'Q1 2026', testDate: '2026-01-15', dateOffset: 0 },
  { label: 'Q2 2026', testDate: '2026-04-15', dateOffset: 90 },
  { label: 'Q3 2026', testDate: '2026-07-15', dateOffset: 180 }
];

/**
 * Get table columns to ensure compatibility with the schema
 */
async function getColumns(tableName) {
  const result = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set(result.rows.map(row => row.column_name));
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
 * Generate overall score for a player in a given quarter
 * At-risk players: [35, 30, 25] (out of 100) - ensures component scores < 5
 * On-track players: base role score + quarter delta - produces component scores 6-10
 */
function generateOverallScore(playerIndex, quarterIndex) {
  const isAtRisk = AT_RISK_INDICES.includes(playerIndex);
  
  if (isAtRisk) {
    // At-risk trajectory: low scores with declining trend
    // These convert to component scores 1-4 (< 5) so 'At Risk' category works correctly
    const atRiskScores = [35, 30, 25];
    return atRiskScores[quarterIndex];
  } else {
    // On-track players: solid scores trending up
    // These convert to component scores 6-10
    const roleBase = {
      'Batsman': 78,
      'Bowler': 76,
      'All-Rounder': 77,
      'Wicketkeeper': 75
    };
    const player = DEMO_PLAYERS[playerIndex];
    const base = roleBase[player.role] || 76;
    const trendBoost = quarterIndex * 2; // +2 per quarter as improvement
    return Math.min(90, base + trendBoost);
  }
}

/**
 * Generate individual component scores based on overall
 */
function generateComponentScores(overallScore) {
  // Normalize from 0-100 to 1-10 scale: divide by 10
  const baseValue = Math.max(1, Math.min(10, overallScore / 10));
  
  // Add some variation to make it realistic
  const physical = Math.round(Math.min(10, baseValue + 0.5)) || 1;
  const skill = Math.round(Math.min(10, baseValue + 0.3)) || 1;
  const mental = Math.round(Math.max(1, baseValue - 0.4)) || 1;
  const coach = Math.round(Math.min(10, baseValue + 0.1)) || 1;
  
  return { physical, skill, mental, coach };
}

/**
 * Determine risk status
 */
function toRiskStatus(overallScore) {
  return overallScore < 60 ? 'At Risk' : 'On Track';
}

/**
 * Calculate improvement percentage
 */
function calculateImprovement(current, previous) {
  if (previous === null) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * POST /api/v1/demo/reset
 * Wipe and recreate demo data with school_id = 1
 */
router.post('/reset', authMiddleware, async (req, res) => {
  const client = await db.connect();
  
  try {
    // Use hardcoded school_id = 1
    const schoolId = 1;

    // Get table schemas
    const playerColumns = await getColumns('players');
    const assessmentColumns = await getColumns('assessment_sessions');

    // Determine DOB column name
    const dobColumn = playerColumns.has('date_of_birth') ? 'date_of_birth'
                     : playerColumns.has('dob') ? 'dob'
                     : playerColumns.has('birth_date') ? 'birth_date'
                     : null;

    // Start transaction
    await client.query('BEGIN');

    // Delete existing data for this school
    await client.query('DELETE FROM assessment_sessions WHERE school_id = $1', [schoolId]);
    await client.query('DELETE FROM players WHERE school_id = $1', [schoolId]);

    // Insert players and collect their IDs
    const insertedPlayers = [];
    
    for (const player of DEMO_PLAYERS) {
      const payload = {};
      setIfColumnExists(payload, playerColumns, 'name', player.name);
      // ALWAYS include school_id explicitly (REQUIRED) - as integer 1
      payload['school_id'] = schoolId;
      setIfColumnExists(payload, playerColumns, 'role', player.role);
      setIfColumnExists(payload, playerColumns, 'gender', player.gender);
      // Use correct column names from schema (std, div instead of standard, division)
      setIfColumnExists(payload, playerColumns, 'std', '8');
      setIfColumnExists(payload, playerColumns, 'standard', '8');  // fallback
      setIfColumnExists(payload, playerColumns, 'div', 'A');
      setIfColumnExists(payload, playerColumns, 'division', 'A');  // fallback
      setIfColumnExists(payload, playerColumns, 'is_active', true);
      
      if (dobColumn) {
        payload[dobColumn] = player.dob;
      }

      const { sql, values } = buildInsertSql('players', payload, 'id, name, role');
      const result = await client.query(sql, values);
      insertedPlayers.push(result.rows[0]);
    }

    // Create a map of player names to IDs
    const playerMap = new Map(insertedPlayers.map(p => [p.name, p.id]));

    // Generate assessments for each player across quarters
    for (let playerIdx = 0; playerIdx < DEMO_PLAYERS.length; playerIdx++) {
      const player = DEMO_PLAYERS[playerIdx];
      const playerId = playerMap.get(player.name);

      let previousOverall = null;

      for (let quarterIdx = 0; quarterIdx < QUARTERS.length; quarterIdx++) {
        const quarter = QUARTERS[quarterIdx];
        const overallScore = generateOverallScore(playerIdx, quarterIdx);
        const improvement = calculateImprovement(overallScore, previousOverall);
        const components = generateComponentScores(overallScore);

        const assessmentPayload = {};
        setIfColumnExists(assessmentPayload, assessmentColumns, 'user_id', playerId);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'player_id', playerId);
        // ALWAYS include school_id explicitly (REQUIRED) - as integer 1
        assessmentPayload['school_id'] = schoolId;
        setIfColumnExists(assessmentPayload, assessmentColumns, 'quarterly_cycle', quarter.label);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'test_date', quarter.testDate);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'overall_score', overallScore);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'improvement_pct', improvement);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'risk_status', toRiskStatus(overallScore));
        
        // Coach feedback based on risk status
        const feedback = toRiskStatus(overallScore) === 'At Risk'
          ? 'Needs focused support and structured improvement plan.'
          : 'Showing good progress. Maintain current effort.';
        setIfColumnExists(assessmentPayload, assessmentColumns, 'coach_feedback', feedback);

        // Component scores
        setIfColumnExists(assessmentPayload, assessmentColumns, 'physical_score', components.physical);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'skill_score', components.skill);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'mental_score', components.mental);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'coach_score', components.coach);

        // Detailed skill scores (if columns exist)
        const baseSkillValue = overallScore / 10;
        setIfColumnExists(assessmentPayload, assessmentColumns, 'speed_score', Math.min(10, baseSkillValue + 0.3));
        setIfColumnExists(assessmentPayload, assessmentColumns, 'agility_score', Math.min(10, baseSkillValue + 0.1));
        setIfColumnExists(assessmentPayload, assessmentColumns, 'endurance_score', Math.max(1, baseSkillValue - 0.2));
        setIfColumnExists(assessmentPayload, assessmentColumns, 'batting_score', 
          Math.min(10, baseSkillValue + (player.role === 'Batsman' ? 0.5 : 0.1)));
        setIfColumnExists(assessmentPayload, assessmentColumns, 'bowling_score',
          Math.min(10, baseSkillValue + (player.role === 'Bowler' ? 0.5 : 0.1)));
        setIfColumnExists(assessmentPayload, assessmentColumns, 'fielding_score', Math.min(10, baseSkillValue + 0.2));
        setIfColumnExists(assessmentPayload, assessmentColumns, 'focus_score', Math.max(1, baseSkillValue - 0.2));
        setIfColumnExists(assessmentPayload, assessmentColumns, 'discipline_score', Math.max(1, baseSkillValue - 0.1));
        setIfColumnExists(assessmentPayload, assessmentColumns, 'game_awareness_score', Math.max(1, baseSkillValue - 0.15));

        const { sql, values } = buildInsertSql('assessment_sessions', assessmentPayload, 'id');
        await client.query(sql, values);

        previousOverall = overallScore;
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Demo data reset complete',
      details: {
        schoolId,
        playersInserted: DEMO_PLAYERS.length,
        atRiskPlayers: AT_RISK_INDICES.length,
        atRiskPlayerNames: AT_RISK_INDICES.map(i => DEMO_PLAYERS[i].name),
        quartersGenerated: QUARTERS.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[demoRoutes] Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to reset demo data',
      details: error.message 
    });
  } finally {
    client.release();
  }
});

module.exports = router;
