'use strict';

const bcrypt = require('bcrypt');
const db = require('./db');

async function createAdmin() {
  try {
    const email = 'admin@sportzwell.com';
    const password = 'admin123';

    const hashedPassword = await bcrypt.hash(password, 10);

    const existing = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      console.log('User already exists. Updating password...');

      await db.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, email]
      );

      console.log('Password updated successfully.');
    } else {
      console.log('Creating new admin user...');

      await db.query(
        'INSERT INTO users (email, password) VALUES ($1, $2)',
        [email, hashedPassword]
      );

      console.log('Admin user created.');
    }

    process.exit();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

createAdmin();