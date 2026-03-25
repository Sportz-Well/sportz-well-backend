require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("render")
    ? { rejectUnauthorized: false }
    : false,
});

async function fixDatabase() {
  try {
    console.log("Connecting to DB...");

    await pool.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);

    console.log("✅ FIX DONE: is_active column added");

    process.exit();
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    process.exit(1);
  }
}

fixDatabase();