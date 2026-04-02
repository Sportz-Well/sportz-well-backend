'use strict';

const pool = require('./db');

async function fixDatabase() {
  console.log("Connecting to live database to force schema update...");
  try {
    // This permanently hammers the missing columns into your live database
    await pool.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS latest_score DECIMAL(5,1),
      ADD COLUMN IF NOT EXISTS coach_signal VARCHAR(50),
      ADD COLUMN IF NOT EXISTS school_id INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS school_id_no VARCHAR(100),
      ADD COLUMN IF NOT EXISTS aadhaar_card_no VARCHAR(100),
      ADD COLUMN IF NOT EXISTS role VARCHAR(50),
      ADD COLUMN IF NOT EXISTS gender VARCHAR(50),
      ADD COLUMN IF NOT EXISTS std VARCHAR(50),
      ADD COLUMN IF NOT EXISTS div VARCHAR(50),
      ADD COLUMN IF NOT EXISTS age INTEGER,
      ADD COLUMN IF NOT EXISTS dob DATE;
    `);
    
    console.log("✅ SUCCESS: All missing columns have been permanently added!");
    process.exit(0);
  } catch (err) {
    console.error("❌ FAILED:", err.message);
    process.exit(1);
  }
}

fixDatabase();