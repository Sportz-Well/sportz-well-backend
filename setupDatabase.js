require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function setup() {
  try {
    console.log("Creating tables...");

    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        gender VARCHAR(10),
        std VARCHAR(50),
        div VARCHAR(50),
        school_id_no VARCHAR(100),
        aadhaar_card_no VARCHAR(20),
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS assessment_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES players(id) ON DELETE CASCADE,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        physical_score INTEGER,
        mental_score INTEGER,
        skill_score INTEGER,
        overall_score INTEGER,
        improvement_pct NUMERIC,
        test_date DATE,
        quarterly_cycle VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Creating indexes...");
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_school_id ON players(school_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user_id ON assessment_sessions(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_assessment_sessions_school_id ON assessment_sessions(school_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_assessment_sessions_lookup ON assessment_sessions(school_id, test_date DESC);`);

    console.log("Tables and indexes created successfully.");

    process.exit();
  } catch (err) {
    console.error("Error creating tables:", err);
    process.exit(1);
  }
}

setup();