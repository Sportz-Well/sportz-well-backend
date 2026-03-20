require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrate() {
  try {
    console.log("Migrating players table...");

    await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS std VARCHAR(50);`);
    await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS div VARCHAR(50);`);
    await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS school_id_no VARCHAR(100);`);
    await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS aadhaar_card_no VARCHAR(20);`);

    console.log("Migration successful.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
