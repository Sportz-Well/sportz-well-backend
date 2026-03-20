'use strict';

const dotenv = require('dotenv');
const db = require('./db');

dotenv.config();

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || 'admin@sportzwell.com';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const AT_RISK_PLAYERS = new Set([
  'Atharva Kulkarni',
  'Kabir Singh',
  'Mihir Deshmukh',
  'Myra Kulkarni'
]);

const QUARTERS = [
  { label: 'Quarter 1', testDate: '2026-03-01', delta: 0 },
  { label: 'Quarter 2', testDate: '2026-06-01', delta: 3 },
  { label: 'Quarter 3', testDate: '2026-09-01', delta: 6 }
];

function getQueryClient(databaseModule) {
  if (databaseModule && typeof databaseModule.query === 'function') {
    return databaseModule;
  }

  if (databaseModule && databaseModule.pool && typeof databaseModule.pool.query === 'function') {
    return databaseModule.pool;
  }

  throw new Error('Database client not found. Expected db.query() or db.pool.query().');
}

const queryClient = getQueryClient(db);

async function query(text, params = []) {
  return queryClient.query(text, params);
}

async function getColumns(tableName) {
  const result = await query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1;
    `,
    [tableName]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function getColumnType(tableName, columnName) {
  const result = await query(
    `
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1;
    `,
    [tableName, columnName]
  );

  return result.rows[0]?.data_type || null;
}

function buildInsertSql(tableName, payload, returning = '*') {
  const keys = Object.keys(payload);
  if (keys.length === 0) {
    throw new Error(`Cannot insert empty payload into ${tableName}`);
  }

  const columns = keys.map((key) => `"${key}"`).join(', ');
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
  const values = keys.map((key) => payload[key]);

  return {
    sql: `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING ${returning};`,
    values
  };
}

function setIfColumnExists(payload, columns, key, value) {
  if (columns.has(key)) {
    payload[key] = value;
  }
}

function toRiskStatus(score) {
  return score < 60 ? 'At Risk' : 'On Track';
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function quarterScoresForPlayer(playerName, role, quarterIndex) {
  const roleBase = {
    Batsman: 78,
    Bowler: 74,
    'All-Rounder': 76,
    Wicketkeeper: 75
  };

  const base = roleBase[role] || 74;
  const trend = QUARTERS[quarterIndex].delta;

  if (AT_RISK_PLAYERS.has(playerName)) {
    const riskCurve = [62, 57, 49];
    return riskCurve[quarterIndex];
  }

  return base + trend;
}

async function tryGetSchoolIdByUserEmail(email) {
  try {
    const result = await query(
      `
        SELECT school_id
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1;
      `,
      [email]
    );

    return result.rows[0]?.school_id || null;
  } catch (_error) {
    return null;
  }
}

async function tryGetSchoolIdFromSchoolsTable() {
  try {
    const result = await query('SELECT id FROM schools LIMIT 1;');
    return result.rows[0]?.id || null;
  } catch (_error) {
    return null;
  }
}

async function tryGetSchoolIdFromPlayersTable() {
  try {
    const result = await query(
      `
        SELECT school_id
        FROM players
        WHERE school_id IS NOT NULL
        LIMIT 1;
      `
    );

    return result.rows[0]?.school_id || null;
  } catch (_error) {
    return null;
  }
}

async function resolveSchoolId() {
  const schoolIdType = await getColumnType('players', 'school_id');
  const expectsUuid = schoolIdType === 'uuid';

  const envSchoolId = String(process.env.DEMO_SCHOOL_ID || '').trim();

  if (envSchoolId) {
    if (!expectsUuid || UUID_REGEX.test(envSchoolId)) {
      return envSchoolId;
    }

    console.warn(
      `[seedDemoData] DEMO_SCHOOL_ID="${envSchoolId}" ignored because players.school_id expects UUID.`
    );
  }

  const fromUser = await tryGetSchoolIdByUserEmail(DEMO_USER_EMAIL);
  if (fromUser) {
    return String(fromUser);
  }

  const fromSchools = await tryGetSchoolIdFromSchoolsTable();
  if (fromSchools) {
    return String(fromSchools);
  }

  const fromPlayers = await tryGetSchoolIdFromPlayersTable();
  if (fromPlayers) {
    return String(fromPlayers);
  }

  throw new Error(
    'Could not resolve school_id. Set DEMO_SCHOOL_ID in .env to a valid school_id value.'
  );
}

async function closeDatabase() {
  const closables = [];
  const seen = new Set();

  if (db && typeof db.end === 'function') {
    closables.push(db);
  }

  if (db && db.pool && typeof db.pool.end === 'function' && !seen.has(db.pool)) {
    closables.push(db.pool);
  }

  for (const client of closables) {
    if (!client || seen.has(client)) {
      continue;
    }

    seen.add(client);

    try {
      await client.end();
    } catch (error) {
      if (!String(error.message || '').includes('Called end on pool more than once')) {
        console.error('[seedDemoData] closeDatabase warning:', error.message);
      }
    }
  }
}

async function resetDemoData() {
  const playersColumns = await getColumns('players');
  const assessmentColumns = await getColumns('assessment_sessions');

  const schoolId = await resolveSchoolId();

  const dobColumn = playersColumns.has('date_of_birth')
    ? 'date_of_birth'
    : playersColumns.has('dob')
      ? 'dob'
      : playersColumns.has('birth_date')
        ? 'birth_date'
        : null;

  if (!playersColumns.has('school_id')) {
    throw new Error('players.school_id column is required.');
  }

  if (!assessmentColumns.has('school_id') || !assessmentColumns.has('user_id')) {
    throw new Error('assessment_sessions.school_id and assessment_sessions.user_id are required.');
  }

  await query('BEGIN');

  try {
    await query('DELETE FROM assessment_sessions WHERE school_id = $1;', [schoolId]);
    await query('DELETE FROM players WHERE school_id = $1;', [schoolId]);

    const insertedPlayers = [];

    for (const player of DEMO_PLAYERS) {
      const payload = {};
      setIfColumnExists(payload, playersColumns, 'name', player.name);
      setIfColumnExists(payload, playersColumns, 'school_id', schoolId);
      setIfColumnExists(payload, playersColumns, 'role', player.role);
      setIfColumnExists(payload, playersColumns, 'gender', player.gender);
      setIfColumnExists(payload, playersColumns, 'standard', '8');
      setIfColumnExists(payload, playersColumns, 'division', 'A');
      setIfColumnExists(payload, playersColumns, 'is_active', true);

      if (dobColumn) {
        payload[dobColumn] = player.dob;
      }

      const { sql, values } = buildInsertSql('players', payload, 'id, name, role');
      const result = await query(sql, values);
      insertedPlayers.push(result.rows[0]);
    }

    const insertedByName = new Map(insertedPlayers.map((row) => [row.name, row.id]));

    for (const player of DEMO_PLAYERS) {
      const playerId = insertedByName.get(player.name);
      if (!playerId) {
        throw new Error(`Unable to map player id for ${player.name}`);
      }

      let previousOverall = null;

      for (let i = 0; i < QUARTERS.length; i += 1) {
        const q = QUARTERS[i];
        const overall = quarterScoresForPlayer(player.name, player.role, i);
        const improvement =
          previousOverall === null ? 0 : round2(((overall - previousOverall) / previousOverall) * 100);

        const assessmentPayload = {};
        setIfColumnExists(assessmentPayload, assessmentColumns, 'user_id', playerId);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'school_id', schoolId);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'quarterly_cycle', q.label);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'test_date', q.testDate);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'overall_score', overall);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'improvement_pct', improvement);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'risk_status', toRiskStatus(overall));
        setIfColumnExists(
          assessmentPayload,
          assessmentColumns,
          'coach_feedback',
          toRiskStatus(overall) === 'At Risk'
            ? 'Needs focused support in next quarter.'
            : 'Good momentum. Keep structured plan.'
        );

        const physical = round2(Math.min(100, overall + 2));
        const skill = round2(Math.min(100, overall + 1));
        const mental = round2(Math.max(0, overall - 3));

        setIfColumnExists(assessmentPayload, assessmentColumns, 'physical_score', physical);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'skill_score', skill);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'mental_score', mental);

        const speed10 = round2(Math.min(10, Math.max(0, overall / 10 + 0.3)));
        const agility10 = round2(Math.min(10, Math.max(0, overall / 10 + 0.1)));
        const endurance10 = round2(Math.min(10, Math.max(0, overall / 10 - 0.1)));
        const batting10 = round2(
          Math.min(10, Math.max(0, overall / 10 + (player.role === 'Batsman' ? 0.5 : 0.1)))
        );
        const bowling10 = round2(
          Math.min(10, Math.max(0, overall / 10 + (player.role === 'Bowler' ? 0.5 : 0.1)))
        );
        const fielding10 = round2(Math.min(10, Math.max(0, overall / 10 + 0.2)));
        const focus10 = round2(Math.min(10, Math.max(0, overall / 10 - 0.2)));
        const discipline10 = round2(Math.min(10, Math.max(0, overall / 10 - 0.1)));
        const gameAwareness10 = round2(Math.min(10, Math.max(0, overall / 10 - 0.15)));

        setIfColumnExists(assessmentPayload, assessmentColumns, 'speed_score', speed10);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'agility_score', agility10);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'endurance_score', endurance10);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'batting_score', batting10);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'bowling_score', bowling10);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'fielding_score', fielding10);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'focus_score', focus10);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'discipline_score', discipline10);
        setIfColumnExists(assessmentPayload, assessmentColumns, 'game_awareness_score', gameAwareness10);

        const { sql, values } = buildInsertSql('assessment_sessions', assessmentPayload, 'id');
        await query(sql, values);

        previousOverall = overall;
      }
    }

    await query('COMMIT');

    console.log('Demo data reset complete.');
    console.log(`School ID used: ${schoolId}`);
    console.log(`Players seeded: ${DEMO_PLAYERS.length} (Girls: 4, Boys: 11)`);
    console.log('At Risk in latest quarter: 4');
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}

resetDemoData()
  .then(async () => {
    await closeDatabase();
  })
  .catch(async (error) => {
    console.error('[seedDemoData] Failed:', error.message);
    await closeDatabase();
    process.exit(1);
  });
