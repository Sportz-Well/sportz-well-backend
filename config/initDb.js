'use strict';

const db = require('../db');

async function initDb() {
  const client = await db.connect();

  try {
    console.log('🔥 CLEAN RESET (NO school_id)');

    await client.query('BEGIN');

    await client.query(`DROP TABLE IF EXISTS assessment_sessions CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS players CASCADE;`);

    await client.query(`
      CREATE TABLE players (
        id SERIAL PRIMARY KEY,
        name TEXT,
        role TEXT,
        gender TEXT,
        standard TEXT,
        division TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE assessment_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        quarterly_cycle TEXT,
        test_date DATE,
        overall_score NUMERIC,
        improvement_pct NUMERIC,
        physical_score NUMERIC,
        skill_score NUMERIC,
        mental_score NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');

    console.log('✅ DB READY (NO school_id)');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ INIT FAILED:', err);
  } finally {
    client.release();
  }
}

module.exports = initDb;