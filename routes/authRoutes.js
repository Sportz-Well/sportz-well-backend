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

    // 🔍 CHECK TABLE STRUCTURE FIRST
    const test = await db.query(`SELECT * FROM users LIMIT 1`);
    console.log('Users table exists');

    // 🔁 TRY INSERT (WITHOUT ON CONFLICT FIRST)
    await db.query(
      `INSERT INTO users (email, password)
       VALUES ($1, $2)`,
      [email, hashed]
    );

    res.json({ success: true, message: 'Inserted fresh user' });

  } catch (err) {
    console.error('CREATE ADMIN ERROR:', err.message);

    res.status(500).json({
      error: err.message
    });
  }
});