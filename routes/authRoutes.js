'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

// ✅ LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ success: true, user: { email: user.email } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 🚨 CREATE ADMIN (NO CONTROLLER DEPENDENCY)
router.get('/create-admin', async (req, res) => {
  try {
    const email = 'admin@sportzwell.com';
    const password = 'admin123';

    const hashed = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (email, password)
       VALUES ($1, $2)
       ON CONFLICT (email)
       DO UPDATE SET password = $2`,
      [email, hashed]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

module.exports = router;