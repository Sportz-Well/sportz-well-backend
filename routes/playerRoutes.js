'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authMiddleware');

// --- 1. FETCH ALL PLAYERS (Protected) ---
router.get('/', authenticate, async (req, res) => {
    try {
        const academy_id = req.user.academy_id;

        // Global admin (academy_id = 0) sees all players
        // Everyone else only sees their own academy's players
        let result;
        if (academy_id === 0) {
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

// --- 2. ADD NEW PLAYER (Protected) ---
router.post('/', authenticate, async (req, res) => {
    try {
        const academy_id = req.user.academy_id;
        const { name, first_name, last_name, role, primary_role } = req.body;

        const finalName = name || (first_name ? `${first_name} ${last_name || ''}`.trim() : 'Unknown Athlete');
        const finalRole = role || primary_role || 'Cricket Player';

        const insertQuery = `
            INSERT INTO players (name, role, academy_id)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;

        const result = await pool.query(insertQuery, [finalName, finalRole, academy_id]);
        res.status(201).json({ success: true, message: "Player added successfully.", data: result.rows[0] });

    } catch (error) {
        console.error("POST Player Error:", error.message);
        res.status(500).json({ error: `DB Error: ${error.message}` });
    }
});

module.exports = router;