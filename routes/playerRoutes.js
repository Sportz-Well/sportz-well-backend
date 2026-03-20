'use strict';

const express = require('express');
const router = express.Router();

const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const schemaCache = {};

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function getColumnMap(tableName) {
  if (schemaCache[tableName]) return schemaCache[tableName];

  const result = await pool.query(
    `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  );

  const map = {};
  for (const row of result.rows) {
    map[row.column_name] = row.data_type;
  }
  schemaCache[tableName] = map;
  return map;
}

function has(map, column) {
  return Object.prototype.hasOwnProperty.call(map, column);
}

function addSchoolFilter({ map, alias, schoolId, whereParts, params }) {
  if (!has(map, 'school_id')) return;
  if (schoolId === undefined || schoolId === null || schoolId === '') return;

  const type = String(map.school_id || '').toLowerCase();
  const raw = String(schoolId).trim();

  if (!raw) return;

  if (type === 'uuid') {
    if (!isUuid(raw)) return;
    params.push(raw);
    whereParts.push(`${alias}.school_id = $${params.length}::uuid`);
    return;
  }

  if (['integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision'].includes(type)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    params.push(n);
    whereParts.push(`${alias}.school_id = $${params.length}`);
    return;
  }

  params.push(raw);
  whereParts.push(`${alias}.school_id::text = $${params.length}`);
}

async function listPlayers(req, res) {
  try {
    const playerCols = await getColumnMap('players');
    const assessmentCols = await getColumnMap('assessment_sessions');

    const schoolId = req.user?.school_id ?? req.query.schoolId ?? req.query.school_id ?? null;
    const params = [];
    const where = ['1=1'];

    addSchoolFilter({
      map: playerCols,
      alias: 'p',
      schoolId,
      whereParts: where,
      params
    });

    const nameExpr = has(playerCols, 'name') ? 'p.name' : "('Player ' || p.id::text)";
    const roleExpr = has(playerCols, 'role') ? 'p.role' : 'NULL::text';
    const genderExpr = has(playerCols, 'gender') ? 'p.gender' : 'NULL::text';

    let dobExpr = 'NULL::date';
    if (has(playerCols, 'dob')) dobExpr = 'p.dob';
    if (has(playerCols, 'date_of_birth')) dobExpr = 'p.date_of_birth';

    let ageExpr = 'NULL::int';
    if (has(playerCols, 'age')) {
      ageExpr = 'p.age';
    } else if (dobExpr !== 'NULL::date') {
      ageExpr = `DATE_PART('year', AGE(CURRENT_DATE, ${dobExpr}))::int`;
    }

    const userRef = has(assessmentCols, 'user_id') ? 'user_id' : (has(assessmentCols, 'player_id') ? 'player_id' : null);
    const overallField = has(assessmentCols, 'overall_score') ? 'overall_score' : 'NULL::numeric';
    const improvementField = has(assessmentCols, 'improvement_pct') ? 'improvement_pct' : 'NULL::numeric';

    const orderCol = ['test_date', 'created_at', 'assessment_date', 'recorded_at', 'id'].find((c) => has(assessmentCols, c));

    const lateral = userRef
      ? `
      SELECT
        ${overallField} AS overall_score,
        ${improvementField} AS improvement_pct
      FROM assessment_sessions a
      WHERE a.${userRef} = p.id
      ${orderCol ? `ORDER BY a.${orderCol} DESC NULLS LAST` : ''}
      LIMIT 1
    `
      : `
      SELECT
        NULL::numeric AS overall_score,
        NULL::numeric AS improvement_pct
    `;

    const sql = `
      SELECT
        p.id,
        ${nameExpr} AS name,
        ${ageExpr} AS age,
        ${dobExpr} AS dob,
        ${roleExpr} AS role,
        ${genderExpr} AS gender,
        COALESCE(latest.overall_score, 0) AS overall_score,
        COALESCE(latest.improvement_pct, 0) AS improvement_pct
      FROM players p
      LEFT JOIN LATERAL (
        ${lateral}
      ) latest ON true
      WHERE ${where.join(' AND ')}
      ORDER BY name ASC NULLS LAST, p.id ASC;
    `;

    const result = await pool.query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('[playerRoutes] listPlayers error:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function getPlayerById(req, res) {
  try {
    const playerCols = await getColumnMap('players');
    const assessmentCols = await getColumnMap('assessment_sessions');

    const nameExpr = has(playerCols, 'name') ? 'p.name' : "('Player ' || p.id::text)";
    const roleExpr = has(playerCols, 'role') ? 'p.role' : 'NULL::text';
    const genderExpr = has(playerCols, 'gender') ? 'p.gender' : 'NULL::text';
    const stdExpr = has(playerCols, 'std') ? 'p.std' : 'NULL::text';
    const divExpr = has(playerCols, 'div') ? 'p.div' : 'NULL::text';
    const schoolIdNoExpr = has(playerCols, 'school_id_no') ? 'p.school_id_no' : 'NULL::text';
    const aadhaarExpr = has(playerCols, 'aadhaar_card_no') ? 'p.aadhaar_card_no' : 'NULL::text';

    const dobExpr = has(playerCols, 'dob')
      ? 'p.dob'
      : (has(playerCols, 'date_of_birth') ? 'p.date_of_birth' : 'NULL::date');

    const userRef = has(assessmentCols, 'user_id') ? 'user_id' : (has(assessmentCols, 'player_id') ? 'player_id' : null);
    const overallField = has(assessmentCols, 'overall_score') ? 'overall_score' : 'NULL::numeric';
    const improvementField = has(assessmentCols, 'improvement_pct') ? 'improvement_pct' : 'NULL::numeric';
    const orderCol = ['test_date', 'created_at', 'assessment_date', 'recorded_at', 'id'].find((c) => has(assessmentCols, c));

    const lateral = userRef
      ? `
      SELECT
        ${overallField} AS overall_score,
        ${improvementField} AS improvement_pct
      FROM assessment_sessions a
      WHERE a.${userRef} = p.id
      ${orderCol ? `ORDER BY a.${orderCol} DESC NULLS LAST` : ''}
      LIMIT 1
    `
      : `
      SELECT NULL::numeric AS overall_score, NULL::numeric AS improvement_pct
    `;

    const schoolId = req.user?.school_id;
    if (!schoolId) {
      return res.status(403).json({ error: 'Unauthorized: No school assigned' });
    }

    const sql = `
      SELECT
        p.id,
        ${nameExpr} AS name,
        ${dobExpr} AS dob,
        ${genderExpr} AS gender,
        ${roleExpr} AS role,
        ${stdExpr} AS std,
        ${divExpr} AS div,
        ${schoolIdNoExpr} AS school_id_no,
        ${aadhaarExpr} AS aadhaar_card_no,
        latest.overall_score,
        latest.improvement_pct
      FROM players p
      LEFT JOIN LATERAL (
        ${lateral}
      ) latest ON true
      WHERE p.id = $1 AND p.school_id = $2
      LIMIT 1;
    `;

    const result = await pool.query(sql, [req.params.id, schoolId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Player not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[playerRoutes] getPlayerById error:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function getPlayerProgress(req, res) {
  try {
    const assessmentCols = await getColumnMap('assessment_sessions');
    const userRef = has(assessmentCols, 'user_id') ? 'user_id' : (has(assessmentCols, 'player_id') ? 'player_id' : null);

    if (!userRef) return res.json([]);

    const overall = has(assessmentCols, 'overall_score') ? 'overall_score' : 'NULL::numeric AS overall_score';
    const improvement = has(assessmentCols, 'improvement_pct') ? 'improvement_pct' : 'NULL::numeric AS improvement_pct';
    const dateField = has(assessmentCols, 'test_date')
      ? 'test_date'
      : (has(assessmentCols, 'created_at') ? 'created_at' : 'CURRENT_DATE::date');

    const schoolId = req.user?.school_id;
    if (!schoolId) {
      return res.status(403).json({ error: 'Unauthorized: No school assigned' });
    }

    const sql = `
      SELECT
        ${overall},
        ${improvement},
        ${dateField} AS test_date
      FROM assessment_sessions
      WHERE ${userRef} = $1 AND school_id = $2
      ORDER BY test_date ASC
      LIMIT 12;
    `;

    const result = await pool.query(sql, [req.params.id, schoolId]);
    return res.json(result.rows);
  } catch (error) {
    console.error('[playerRoutes] getPlayerProgress error:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function addPlayer(req, res) {
  try {
    const cols = await getColumnMap('players');

    const {
      name,
      age,
      dob,
      role,
      gender,
      std,
      div,
      school_id_no,
      aadhaar_card_no
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const fields = [];
    const placeholders = [];
    const values = [];

    function pushField(field, value) {
      fields.push(field);
      values.push(value);
      placeholders.push(`$${values.length}`);
    }

    if (has(cols, 'name')) pushField('name', String(name).trim());

    if (has(cols, 'dob') && dob) pushField('dob', dob);
    if (has(cols, 'date_of_birth') && dob) pushField('date_of_birth', dob);

    if (has(cols, 'age')) {
      const parsedAge = Number(age);
      if (Number.isFinite(parsedAge)) {
        pushField('age', parsedAge);
      } else if (dob) {
        const birth = new Date(dob);
        if (!Number.isNaN(birth.getTime())) {
          const now = new Date();
          let calc = now.getFullYear() - birth.getFullYear();
          const m = now.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) calc--;
          if (calc >= 0) pushField('age', calc);
        }
      }
    }

    if (has(cols, 'role') && role) pushField('role', role);
    if (has(cols, 'gender') && gender) pushField('gender', gender);
    if (has(cols, 'std') && std) pushField('std', std);
    if (has(cols, 'div') && div) pushField('div', div);
    if (has(cols, 'school_id_no') && school_id_no) pushField('school_id_no', school_id_no);
    if (has(cols, 'aadhaar_card_no') && aadhaar_card_no) pushField('aadhaar_card_no', aadhaar_card_no);

    if (has(cols, 'school_id')) {
      const schoolId = req.user?.school_id;
      if (!schoolId) {
        return res.status(403).json({ error: 'Unauthorized: No school assigned' });
      }
      pushField('school_id', schoolId);
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No valid player fields provided' });
    }

    const sql = `
      INSERT INTO players (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING id;
    `;

    const result = await pool.query(sql, values);
    return res.json({
      message: 'Player added',
      id: result.rows[0]?.id || null
    });
  } catch (error) {
    console.error('[playerRoutes] addPlayer error:', error.message);
    return res.status(500).json({ error: 'Add player failed' });
  }
}

// New clean paths
router.get('/', authMiddleware, listPlayers);
router.get('/:id', authMiddleware, getPlayerById);
router.get('/:id/progress', authMiddleware, getPlayerProgress);
router.post('/', authMiddleware, addPlayer);

// Backward-compatible old paths
router.get('/players', authMiddleware, listPlayers);
router.get('/player/:id', authMiddleware, getPlayerById);
router.get('/player/:id/progress', authMiddleware, getPlayerProgress);
router.post('/players', authMiddleware, addPlayer);

module.exports = router;
