require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function check() {
  try {
    const players = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'players'
    `);

    console.log("\nPLAYERS TABLE:");
    console.table(players.rows);

    const assessments = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'assessment_sessions'
    `);

    console.log("\nASSESSMENT_SESSIONS TABLE:");
    console.table(assessments.rows);

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();