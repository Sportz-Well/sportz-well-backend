'use strict';

const db = require('../db');

async function initDb() {
  const client = await db.connect();

  try {
    console.log('Initializing database...');

    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        name TEXT,
        role TEXT,
        gender TEXT,
        standard TEXT,
        division TEXT,
        is_active BOOLEAN DEFAULT true,
        school_id INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS assessment_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        school_id INTEGER DEFAULT 1,
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

    await client.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS school_id INTEGER DEFAULT 1;
    `);

    await client.query(`
      ALTER TABLE assessment_sessions
      ADD COLUMN IF NOT EXISTS school_id INTEGER DEFAULT 1;
    `);

    await client.query('COMMIT');

    console.log('Database initialized successfully');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DB Init Error:', err);
  } finally {
    client.release();
  }
}

module.exports = initDb;