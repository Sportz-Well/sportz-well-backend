'use strict';

const bcrypt = require('bcrypt');
const db = require('./db');

async function createCoach() {
  try {
    const email = 'coach@sportzwell.com';
    const password = 'demo123';

    const hashedPassword = await bcrypt.hash(password, 10);

    const existing = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      console.log('Coach user already exists. Updating password...');
      await db.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, email]
      );
      console.log('Coach password updated successfully.');
    } else {
      console.log('Creating new coach user...');
      await db.query(
        'INSERT INTO users (email, password) VALUES ($1, $2)',
        [email, hashedPassword]
      );
      console.log('Coach user created successfully.');
    }

    process.exit();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

createCoach();