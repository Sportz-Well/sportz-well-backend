'use strict';

const bcrypt = require('bcrypt');
const db = require('../db');

// LOGIN
async function login(req, res) {
  try {
    // 1. THE SPY: Print exactly what the frontend is sending us
    console.log("--- NEW LOGIN ATTEMPT ---");
    console.log("Raw Request Body:", req.body);

    // 2. CATCH-ALL: Check for every possible variable name the frontend might be using
    const { email, password, username, pass } = req.body;

    const rawEmail = email || username || '';
    const rawPass = password || pass || '';

    const safeEmail = String(rawEmail).trim().toLowerCase();
    const safePassword = String(rawPass).trim();

    console.log(`Cleaned Data -> Email: '${safeEmail}', Password: '${safePassword}'`);

    // =========================================================
    // THE ULTIMATE DEMO OVERRIDE
    // If the email has 'coach' in it, OR the password is 'demo123', let them in!
    // =========================================================
    if (safeEmail.includes('coach') || safePassword === 'demo123') {
      console.log("✅ VIP Master Key Accepted! Opening door.");
      return res.json({
        success: true,
        token: 'swpi-demo-token-12345',
        user: { id: 999, email: 'coach@sportz-well.com', role: 'coach' }
      });
    }
    // =========================================================

    const result = await db.query('SELECT * FROM users WHERE email = $1', [safeEmail]);

    if (result.rows.length === 0) {
      console.log("❌ DB Check Failed: User not found");
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(safePassword, user.password);

    if (!match) {
      console.log("❌ DB Check Failed: Password mismatch");
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log("✅ Regular DB Login Successful!");
    return res.json({
      success: true,
      token: 'swpi-demo-token-12345',
      user: { id: user.id, email: user.email, role: user.role || 'coach' }
    });

  } catch (err) {
    console.error("Server Error during login:", err);
    res.status(500).json({ error: 'Server error' });
  }
}

// TEMP ADMIN CREATION
async function createAdmin(req, res) {
  try {
    const email = 'admin@sportzwell.com';
    const password = 'admin123';
    const hashed = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (email, password, role) VALUES ($1, $2, 'admin') ON CONFLICT (email) DO UPDATE SET password = $2`,
      [email, hashed]
    );
    res.json({ success: true, message: 'Admin created/updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create admin' });
  }
}

module.exports = { login, createAdmin };