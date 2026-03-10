require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function resetAdmin() {
  try {

    await pool.query("DELETE FROM users WHERE email='admin@sportzwell.com'");

    await pool.query(`
      INSERT INTO users (email, password, role)
      VALUES ('admin@sportzwell.com','admin123','admin')
    `);

    console.log("Admin reset successfully");

    process.exit();

  } catch (err) {
    console.error(err);
  }
}

resetAdmin();