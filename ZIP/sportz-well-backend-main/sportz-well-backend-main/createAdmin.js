require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash("admin123", 10);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        school_id UUID REFERENCES schools(id),
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const schoolResult = await pool.query(`SELECT id FROM schools LIMIT 1`);
    const schoolId = schoolResult.rows[0].id;

    await pool.query(`
      INSERT INTO users (email, password, school_id, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, [
      'admin@sportzwell.com',
      hashedPassword,
      schoolId,
      'admin'
    ]);

    console.log("Admin user created.");
    process.exit();

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createAdmin();