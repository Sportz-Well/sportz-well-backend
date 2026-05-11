'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

// --- GET ALL PLAYERS ---
// Admin (academy_id = 0 OR role = admin) sees all players
// Coach sees only their academy
router.get('/', authenticate, async (req, res) => {
  try {
    const { academy_id, role } = req.user;
    let result;

    if (role === 'admin' || academy_id === 0) {
      result = await pool.query('SELECT * FROM players ORDER BY name ASC');
    } else {
      result = await pool.query(
        'SELECT * FROM players WHERE academy_id = $1 ORDER BY name ASC',
        [academy_id]
      );
    }

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("GET Players Error:", error.message);
    res.status(500).json({ error: `DB Error: ${error.message}` });
  }
});

// --- ADD PLAYER (POST /) ---
// No Aadhaar field. Ever.
router.post('/', authenticate, async (req, res) => {
  try {
    const academy_id = req.user.academy_id;
    const { name, first_name, last_name, role, primary_role, date_of_birth, gender, std_div, school_id, mobile_no } = req.body;

    const finalName = name || (first_name ? `${first_name} ${last_name || ''}`.trim() : 'Unknown Athlete');
    const finalRole = role || primary_role || 'Cricket Player';

    const result = await pool.query(
      `INSERT INTO players (name, role, academy_id, date_of_birth, gender, std_div, school_id, mobile_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [finalName, finalRole, academy_id, date_of_birth || null, gender || null, std_div || null, school_id || null, mobile_no || null]
    );

    res.status(201).json({ success: true, message: "Player added.", data: result.rows[0] });
  } catch (error) {
    console.error("POST Player Error:", error.message);
    res.status(500).json({ error: `DB Error: ${error.message}` });
  }
});

// --- ADD PLAYER (POST /add alias) ---
router.post('/add', authenticate, async (req, res) => {
  try {
    const academy_id = req.user.academy_id;
    const { name, role, primary_role, date_of_birth, gender, std_div, school_id, mobile_no } = req.body;

    const finalName = name || 'Unknown Athlete';
    const finalRole = role || primary_role || 'Cricket Player';

    const result = await pool.query(
      `INSERT INTO players (name, role, academy_id, date_of_birth, gender, std_div, school_id, mobile_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [finalName, finalRole, academy_id, date_of_birth || null, gender || null, std_div || null, school_id || null, mobile_no || null]
    );

    res.status(201).json({ success: true, message: "Player added.", data: result.rows[0] });
  } catch (error) {
    console.error("POST /add Player Error:", error.message);
    res.status(500).json({ error: `DB Error: ${error.message}` });
  }
});

// --- DELETE PLAYER (admin only) ---
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM players WHERE id = $1', [id]);
    res.status(200).json({ success: true, message: "Player deleted." });
  } catch (error) {
    console.error("DELETE Player Error:", error.message);
    res.status(500).json({ error: `DB Error: ${error.message}` });
  }
});

module.exports = router;