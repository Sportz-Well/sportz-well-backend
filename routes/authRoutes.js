'use strict';
const express  = require('express');
const router   = express.Router();
const pool     = require('../db');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'swpi-production-secret-2026';

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    // Single DB lookup — no bypass, no hardcoding
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Support both bcrypt hashed and plain text passwords
    const dbPassword = user.password_hash || user.password;
    let isMatch = false;

    if (dbPassword && (dbPassword.startsWith('$2b$') || dbPassword.startsWith('$2a$'))) {
      isMatch = await bcrypt.compare(password, dbPassword);
    } else {
      isMatch = (password === dbPassword);
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id:         user.id,
        email:      user.email,
        role:       user.role,
        academy_id: user.academy_id
      },
      SECRET,
      { expiresIn: '24h' }
    );

    console.log(`Login: ${user.email} | role: ${user.role} | academy_id: ${user.academy_id}`);

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role, academy_id: user.academy_id }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;