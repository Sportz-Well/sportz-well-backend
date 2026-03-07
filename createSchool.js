require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function createSchool() {
  try {
    const result = await pool.query(`
      INSERT INTO schools (name)
      VALUES ('Singhania Cricket Academy')
      RETURNING id;
    `);

    console.log("School created with ID:", result.rows[0].id);
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createSchool();