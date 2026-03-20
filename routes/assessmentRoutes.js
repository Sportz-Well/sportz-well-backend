'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const schemaCache = {};

async function getColumnMap(tableName) {
  if (schemaCache[tableName]) return schemaCache[tableName];

  const result = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  );

  const map = {};
  for (const row of result.rows) map[row.column_name] = true;
  schemaCache[tableName] = map;
  return map;
}

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function scoreInRange(v) {
  return Number.isInteger(v) && v >= 1 && v <= 10;
}

async function saveAssessment(req, res) {
  try {
    const cols = await getColumnMap('assessment_sessions');

    const rawId = req.body?.user_id ?? req.body?.player_id ?? '';
    const userId = String(rawId).trim();

    const quarter = String(req.body?.quarter ?? req.body?.quarterly_cycle ?? 'Quarter 1').trim();

    const physical = toInt(req.body.physical ?? req.body.physical_score);
    const skill = toInt(req.body.skill ?? req.body.skill_score);
    const mental = toInt(req.body.mental ?? req.body.mental_score);
    const coach = toInt(req.body.coach ?? req.body.coach_score ?? 0);

    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const requiredScores = [physical, skill, mental];
    if (requiredScores.some((s) => s === null)) {
      return res.status(400).json({ error: 'physical, skill, mental are required' });
    }

    const allScores = [physical, skill, mental, coach];
    if (!allScores.every(scoreInRange)) {
      return res.status(400).json({ error: 'Scores must be between 0 and 100' });
    }

    const overall = Math.round((physical + skill + mental + coach) / 4);

    const fields = [];
    const placeholders = [];
    const values = [];

    function pushField(field, value) {
      fields.push(field);
      values.push(value);
      placeholders.push(`$${values.length}`);
    }

    if (cols.user_id) pushField('user_id', userId);
    if (cols.player_id) pushField('player_id', userId);

    if (cols.school_id) {
      const schoolId = req.user?.school_id;
      if (!schoolId) {
        return res.status(403).json({ error: 'Unauthorized: No school assigned' });
      }
      pushField('school_id', schoolId);
    }

    if (cols.quarterly_cycle) pushField('quarterly_cycle', quarter);

    if (cols.physical_score) pushField('physical_score', physical);
    if (cols.skill_score) pushField('skill_score', skill);
    if (cols.mental_score) pushField('mental_score', mental);
    if (cols.coach_score) pushField('coach_score', coach);

    if (cols.overall_score) pushField('overall_score', overall);
    if (cols.improvement_pct) pushField('improvement_pct', 0);

    if (cols.test_date) {
      fields.push('test_date');
      placeholders.push('CURRENT_DATE');
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No compatible assessment columns found' });
    }

    const sql = `
      INSERT INTO assessment_sessions (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;

    await pool.query(sql, values);

    return res.json({
      message: 'Assessment Saved Successfully',
      overall_score: overall
    });
  } catch (error) {
    console.error('[assessmentRoutes] saveAssessment error:', error.message);
    return res.status(500).json({ error: 'Save failed' });
  }
}

router.post('/save', authMiddleware, saveAssessment);
router.post('/assessment/save', authMiddleware, saveAssessment);

module.exports = router;
