const db = require('./db');

async function runMigration() {
  try {
    console.log("Starting DB Migration...");

    // Add missing columns safely
    await db.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS std TEXT,
      ADD COLUMN IF NOT EXISTS div TEXT,
      ADD COLUMN IF NOT EXISTS school_id_no TEXT,
      ADD COLUMN IF NOT EXISTS aadhaar_card_no TEXT,
      ADD COLUMN IF NOT EXISTS gender TEXT,
      ADD COLUMN IF NOT EXISTS role TEXT,
      ADD COLUMN IF NOT EXISTS dob DATE;
    `);

    console.log("Migration completed successfully");

    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigration();