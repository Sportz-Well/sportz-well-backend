'use strict';

const bcrypt = require('bcrypt');
const db = require('./db');

async function setupDemoUsers() {
  try {
    // The exact accounts we want to create
    const accounts = [
      { email: 'admin@sportz-well.com', password: 'admin123' },
      { email: 'coach@sportz-well.com', password: 'demo123' }
    ];

    console.log('Starting account setup...');

    for (const account of accounts) {
      const hashedPassword = await bcrypt.hash(account.password, 10);
      
      const existing = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [account.email]
      );

      if (existing.rows.length > 0) {
        console.log(`[UPDATE] ${account.email} already exists. Updating password...`);
        await db.query(
          'UPDATE users SET password = $1 WHERE email = $2',
          [hashedPassword, account.email]
        );
      } else {
        console.log(`[CREATE] Creating new account for ${account.email}...`);
        await db.query(
          'INSERT INTO users (email, password) VALUES ($1, $2)',
          [account.email, hashedPassword]
        );
      }
    }

    console.log('\n✅ SUCCESS: Both Admin and Coach accounts are ready to use!');
    process.exit();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

setupDemoUsers();