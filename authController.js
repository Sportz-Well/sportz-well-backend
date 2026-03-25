'use strict';

const bcrypt = require('bcrypt');
const db = require('../db');

// LOGIN
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // BULLETPROOF FIX: Destroy invisible spaces and force lowercase
    const safeEmail = email ? String(email).trim().toLowerCase() : '';

    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [safeEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(String(password), user.password);

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // EXTRA SAFETY: Ensure frontend gets everything it could possibly need
    return res.json({
      success: true,
      token: 'swpi-demo-token-12345', 
      user: { 
        id: user.id,
        email: user.email,
        role: user.role || 'coach'
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// TEMP ADMIN CREATION (Fixed Database Constraints)
async function createAdmin(req, res) {
  try {
    const email = 'admin@sportzwell.com';
    const password = 'admin123';

    const hashed = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (email, password, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (email)
       DO UPDATE SET password = $2`,
      [email, hashed]
    );

    res.json({ success: true, message: 'Admin created/updated' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create admin' });
  }
}

module.exports = {
  login,
  createAdmin
};