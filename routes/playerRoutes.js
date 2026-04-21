'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Add Player (Now supports Multi-Academy architecture)
router.post('/', async (req, res) => {
    try {
        const { name, dob, gender, role, school_id_no, aadhaar_card_no, std, div, academy_id } = req.body;

        if (!name || !dob) {
            return res.status(400).json({ success: false, message: "Name and DOB are strictly required." });
        }

        // Default to Singhania (1) if no academy_id is passed during MVP demo
        const a_id = academy_id || 1; 

        const insertQuery = `
            INSERT INTO players (
                academy_id, school_id, name, date_of_birth, gender, role, 
                school_id_no, aadhaar_card_no, std, div, coach_signal
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Stable') RETURNING *;
        `;
        
        // We insert into both academy_id and school_id to maintain legacy compatibility
        const result = await pool.query(insertQuery, [
            a_id, a_id, name, dob, gender || 'Not Specified', role || 'Unassigned',
            school_id_no || null, aadhaar_card_no || null, std || null, div || null
        ]);

        res.status(201).json({ success: true, player: result.rows[0] });
    } catch (err) {
        console.error("Add Player Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get Players (Filters by Academy)
router.get('/', async (req, res) => {
    try {
        // Look for academy_id in the query string, default to Singhania (1) for MVP
        const academyId = req.query.academy_id || 1; 
        
        // This query checks the new walls. It will only return players inside this specific academy.
        const result = await pool.query(
            'SELECT * FROM players WHERE academy_id = $1 OR school_id = $1 ORDER BY name ASC', 
            [academyId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;